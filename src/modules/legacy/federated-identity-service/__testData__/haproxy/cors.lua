--
-- Cross-origin Request Sharing (CORS) implementation for HAProxy Lua host
--
-- CORS RFC:
-- https://www.w3.org/TR/cors/
--
-- Copyright (c) 2019. Nick Ramirez <nramirez@haproxy.com>
-- Copyright (c) 2019. HAProxy Technologies, LLC.

local M={}

-- Loops through array to find the given string.
-- items: array of strings
-- test_str: string to search for
function contains(items, test_str)
  for _,item in pairs(items) do
    if item == test_str then
      return true
    end
  end

  return false
end

M.wildcard_origin_allowed = function(allowed_origins)
  if contains(allowed_origins, "*") then
    return "*"
  end
  return nil
end

M.specifies_scheme = function(s)
  return string.find(s, "^%a+://") ~= nil
end

M.specifies_generic_scheme = function(s)
  return string.find(s, "^//") ~= nil
end

M.begins_with_dot = function(s)
  return string.find(s, "^%.") ~= nil
end

M.trim = function(s)
  return s:gsub("%s+", "")
end

M.build_pattern = function(pattern)
  -- remove spaces
  pattern = M.trim(pattern)

  if pattern ~= nil and pattern ~= '' then
    -- if there is no scheme and the pattern does not begin with a dot, 
    -- add the generic scheme to the beginning of the pattern
    if M.specifies_scheme(pattern) == false and M.specifies_generic_scheme(pattern) == false and M.begins_with_dot(pattern) == false then
      pattern = "//" .. pattern
    end

    -- escape dots and dashes in pattern
    pattern = pattern:gsub("([%.%-])", "%%%1")

    -- an asterisk for the port means allow all ports
    if string.find(pattern, "[:]+%*$") ~= nil then
      pattern = pattern:gsub("[:]+%*$", "[:]+[0-9]+")
    end

    -- append end character
    pattern = pattern .. "$"
    return pattern
  end

  return nil
end

-- If the given origin is found within the allowed_origins string, it is returned. Otherwise, nil is returned.
-- origin: The value from the 'origin' request header
-- allowed_origins: Comma-delimited list of allowed origins. (e.g. localhost,https://localhost:8080,//test.com)
--   e.g. localhost                : allow http(s)://localhost
--   e.g. //localhost              : allow http(s)://localhost
--   e.g. https://mydomain.com     : allow only HTTPS of mydomain.com
--   e.g. http://mydomain.com      : allow only HTTP of mydomain.com
--   e.g. http://mydomain.com:8080 : allow only HTTP of mydomain.com from port 8080
--   e.g. //mydomain.com           : allow only http(s)://mydomain.com
--   e.g. .mydomain.com            : allow ALL subdomains of mydomain.com from ALL source ports
--   e.g. .mydomain.com:443        : allow ALL subdomains of mydomain.com from default HTTPS source port
-- 
--  e.g. ".mydomain.com:443, //mydomain.com:443, //localhost"
--    allows all subdomains and main domain of mydomain.com only for HTTPS from default HTTPS port and allows 
--    all HTTP and HTTPS connections from ALL source port for localhost
--    
M.get_allowed_origin = function(origin, allowed_origins)
  if origin ~= nil then
    -- if wildcard (*) is allowed, return it, which allows all origins
    wildcard_origin = M.wildcard_origin_allowed(allowed_origins)
    if wildcard_origin ~= nil then
      return wildcard_origin
    end

    for index, allowed_origin in ipairs(allowed_origins) do
      pattern = M.build_pattern(allowed_origin)

      if pattern ~= nil then
        if origin:match(pattern) then
          core.Debug("Test: " .. pattern .. ", Origin: " .. origin .. ", Match: yes")
          return origin
        else
          core.Debug("Test: " .. pattern .. ", Origin: " .. origin .. ", Match: no")
        end
      end
    end
  end

  return nil
end

-- Adds headers for CORS preflight request and then attaches them to the response
-- after it comes back from the server. This works with versions of HAProxy prior to 2.2.
-- The downside is that the OPTIONS request must be sent to the backend server first and can't 
-- be intercepted and returned immediately.
-- txn: The current transaction object that gives access to response properties
-- allowed_methods: Comma-delimited list of allowed HTTP methods. (e.g. GET,POST,PUT,DELETE)
-- allowed_headers: Comma-delimited list of allowed headers. (e.g. X-Header1,X-Header2)
function preflight_request_ver1(txn, allowed_methods, allowed_headers)
  core.Debug("CORS: preflight request received")
  txn.http:res_set_header("Access-Control-Allow-Methods", allowed_methods)
  txn.http:res_set_header("Access-Control-Allow-Headers", allowed_headers)
  txn.http:res_set_header("Access-Control-Max-Age", 600)
  core.Debug("CORS: attaching allowed methods to response")
end

-- Add headers for CORS preflight request and then returns a 204 response.
-- The 'reply' function used here is available in HAProxy 2.2+. It allows HAProxy to return
-- a reply without contacting the server.
-- txn: The current transaction object that gives access to response properties
-- origin: The value from the 'origin' request header
-- allowed_methods: Comma-delimited list of allowed HTTP methods. (e.g. GET,POST,PUT,DELETE)
-- allowed_origins: Comma-delimited list of allowed origins. (e.g. localhost,localhost:8080,test.com)
-- allowed_headers: Comma-delimited list of allowed headers. (e.g. X-Header1,X-Header2)
function preflight_request_ver2(txn, origin, allowed_methods, allowed_origins, allowed_headers)
  core.Debug("CORS: preflight request received")

  local reply = txn:reply()
  reply:set_status(204, "No Content")
  reply:add_header("Content-Type", "text/html")
  reply:add_header("Access-Control-Allow-Methods", allowed_methods)
  reply:add_header("Access-Control-Allow-Headers", allowed_headers)
  reply:add_header("Access-Control-Max-Age", 600)

  local allowed_origin = M.get_allowed_origin(origin, allowed_origins)

  if allowed_origin == nil then
    core.Debug("CORS: " .. origin .. " not allowed")
  else
    core.Debug("CORS: " .. origin .. " allowed")
    reply:add_header("Access-Control-Allow-Origin", allowed_origin)

    if allowed_origin ~= "*" then
      reply:add_header("Vary", "Accept-Encoding,Origin")
    end
  end

  core.Debug("CORS: Returning reply to preflight request")
  txn:done(reply)
end

-- When invoked during a request, captures the origin header if present and stores it in a private variable.
-- If the request is OPTIONS and it is a supported version of HAProxy, returns a preflight request reply.
-- Otherwise, the preflight request header is added to the response after it has returned from the server.
-- txn: The current transaction object that gives access to response properties
-- allowed_methods: Comma-delimited list of allowed HTTP methods. (e.g. GET,POST,PUT,DELETE)
-- allowed_origins: Comma-delimited list of allowed origins. (e.g. localhost,localhost:8080,test.com)
-- allowed_headers: Comma-delimited list of allowed headers. (e.g. X-Header1,X-Header2)
function cors_request(txn, allowed_methods, allowed_origins, allowed_headers)
  local headers = txn.http:req_get_headers()
  local transaction_data = {}
  local origin = nil
  local allowed_origins = core.tokenize(allowed_origins, ",")
  
  if headers["origin"] ~= nil and headers["origin"][0] ~= nil then
    core.Debug("CORS: Got 'Origin' header: " .. headers["origin"][0])
    origin = headers["origin"][0]
  end

  -- Bail if client did not send an Origin
  -- for example, it may be a regular OPTIONS request that is not a CORS preflight request
  if origin == nil or origin == '' then
    return
  end
  
  transaction_data["origin"] = origin
  transaction_data["allowed_methods"] = allowed_methods
  transaction_data["allowed_origins"] = allowed_origins
  transaction_data["allowed_headers"] = allowed_headers

  txn:set_priv(transaction_data)

  local method = txn.sf:method()
  transaction_data["method"] = method

  if method == "OPTIONS" and txn.reply ~= nil then
    preflight_request_ver2(txn, origin, allowed_methods, allowed_origins, allowed_headers)
  end
end

-- When invoked during a response, sets CORS headers so that the browser can read the response from permitted domains.
-- txn: The current transaction object that gives access to response properties.
function cors_response(txn)
  local transaction_data = txn:get_priv()

  if transaction_data == nil then
    return
  end
  
  local origin = transaction_data["origin"]
  local allowed_origins = transaction_data["allowed_origins"]
  local allowed_methods = transaction_data["allowed_methods"]
  local allowed_headers = transaction_data["allowed_headers"]
  local method = transaction_data["method"]

  -- Bail if client did not send an Origin
  if origin == nil or origin == '' then
    return
  end

  local allowed_origin = M.get_allowed_origin(origin, allowed_origins)

  if allowed_origin == nil then
    core.Debug("CORS: " .. origin .. " not allowed")
  else
    if method == "OPTIONS" and txn.reply == nil then
      preflight_request_ver1(txn, allowed_methods, allowed_headers)
    end
    
    core.Debug("CORS: " .. origin .. " allowed")
    txn.http:res_set_header("Access-Control-Allow-Origin", allowed_origin)

    if allowed_origin ~= "*" then
      txn.http:res_add_header("Vary", "Accept-Encoding,Origin")
    end
  end
end

-- Register the actions with HAProxy
core.register_action("cors", {"http-req"}, cors_request, 3)
core.register_action("cors", {"http-res"}, cors_response, 0)

return M

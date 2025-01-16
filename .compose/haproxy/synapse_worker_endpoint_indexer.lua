-- AIM OF FILE : Allow redirecting endpoints to specific workers for synapse
-- FILES IT REQUIRES : lua_endpoint_to_function.map.cfg and lua_function_to_worker.map.cfg
-- NOTE : THE PATH IS HARDCODED HERE

local default_worker = "matrix" -- THE DEFAULT WORKER IF THE ENDPOINT IS NOT RECOGNIZED
-- matrix is the name of the backend in haproxy.cfg

local endp_to_func_file, err1 = io.open("/usr/local/etc/haproxy/lua_endpoint_to_function.map_rewrite.cfg", "r")
local func_to_worker_file, err2 = io.open("/usr/local/etc/haproxy/lua_function_to_worker.map_rewrite.cfg", "r")

local endpoint_regex_table, worker_table = {}, {}
local functions_found = {}

-- to live-debug where each received endpoint gets redirected to in terms of backend
local debug = false -- set to true to print endpoint associations.
local print_debug = "[HAProxy|LUA] "

local function print_debug_fn(...)
    if debug then
        print(...)
    end
end

assert(endp_to_func_file, "ENDPOINT TO FUNC MAP FILE NOT FOUND")
assert(func_to_worker_file, "FUNC TO WORKER MAP FILE NOT FOUND")

function parse_or_tbl(str_tbl)
    --[[
        Duplicates the entries in str_tbl when they are in the an (.. | ..) format
        Returns the number of instances of the pattern found
        ex : {"(hi|there)"} becomes {"hi", "there"}, with 1 returned
    ]]
    local count = 0
    local to_add = {} -- list of elements to add
    local to_remove = {} -- contains list of keys to remove
    
    for k,v in pairs(str_tbl) do
        if ( v == nil ) then 
            goto continue_parse
        end

        line = v
        -- v is the string to multiply given the "or"
        local split_first, split_last = line:find("%((.-%|.-)%)")
        if (split_first ~= nil) and (split_last ~= nil) then
            split_first = split_first + 1
            split_last = split_last - 1
    
            local to_split = line:sub(split_first, split_last).."|"
            
            local splits = {}
            to_split:gsub("([^".."%|".."]*)".."%|", function(capture)
                table.insert(splits, capture)
            end)

            count = count + 1
            
            to_remove[#to_remove+1] = k

            for k2, v2 in pairs(splits) do
                to_add[#to_add+1] = line:sub(1, split_first-2)..v2..line:sub(split_last+2, string.len(line))
            end
        end
        ::continue_parse::
    end

    for k,v in pairs(to_remove) do
        if (str_tbl[k] ~= nil) then
            table.remove(str_tbl, k)
        end
    end

    for k,v in pairs(to_add) do
        table.insert(str_tbl, v)
    end

    return count
end

-- Associated each endpoint to a function
for line in endp_to_func_file:lines() do
    if line:sub(1,1) == "#" then
        goto continue
    end
    
    local first, second = line:match("(%S+) (%S+)")

    if (first == nil) or (second==nil) then
        goto continue
    end
    local endpoints = {first}
    
    while (parse_or_tbl(endpoints) > 0) do
        -- duplicates the entries in endpoints
    end

    for k,v in pairs(endpoints) do
        endpoint_regex_table[v] = second
        functions_found[v] = true
        print_debug_fn(print_debug, "associated endpoint", v, second)
    end

    ::continue::
end

print_debug_fn(print_debug, "--------------------------------")

-- Associate each function to a worker
for line in func_to_worker_file:lines() do
    if line:sub(1,1) == "#" then
        goto continue_2
    end

    local first, second = line:match("(%S+) (%S+)")

    if (first == nil) or (second==nil) then
        goto continue_2
    end
    
    worker_table[first] = second
    print_debug_fn(print_debug, "associated function", first, second)
    ::continue_2::
end

function log(message)
    -- Logs the message in haproxy console if it debug is enabled above
    if debug then
        core.log(core.info, message)
    end
end

core.register_fetches("path_to_worker", function(txn)
    --[[ 
        TODO: Documentation
    ]]--
    local path = txn.f:path()
    log(print_debug.." PATH OF REQUEST "..path)
    local func, worker;

    if (path == nil) then
        log(print_debug.." PATH NOT FOUND")
        worker=default_worker
        goto finish_calc
    end

    for k,v in pairs(endpoint_regex_table) do
        --core.log(core.info, print_debug.." TRYING "..k)
        if (path:match(k)) then
            func = v
            break;
        end
    end
    
    if (func == nil) then
        log(print_debug.." FUNCTION NOT FOUND")
        worker=default_worker
        goto finish_calc
    end

    worker = worker_table[func] or default_worker

    ::finish_calc::
    log(print_debug.." USING WORKER "..worker)

    return worker
end)
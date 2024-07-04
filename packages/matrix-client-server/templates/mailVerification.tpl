Date: __date__
From: __from__
To: __to__
Message-ID: __messageid__
Subject: Confirm your email address for Matrix
MIME-Version: 1.0
Content-Type: multipart/alternative;
	boundary="__multipart_boundary__"

--__multipart_boundary__
Content-Type: text/plain; charset=UTF-8
Content-Disposition: inline
Hello,
We have received a request to use this email address with a matrix.org identity
server. If this was you who made this request, you may use the following link
to complete the verification of your email address:
__link__
If your client requires a code, the code is __token__
If you aren't aware of making such a request, please disregard this email.
About Matrix:
Matrix is an open standard for interoperable, decentralised, real-time communication
over IP. It can be used to power Instant Messaging, VoIP/WebRTC signalling, Internet
of Things communication - or anywhere you need a standard HTTP API for publishing and
subscribing to data whilst tracking the conversation history.
Matrix defines the standard, and provides open source reference implementations of
Matrix-compatible Servers, Clients, Client SDKs and Application Services to help you
create new communication solutions or extend the capabilities and reach of existing ones.
--__multipart_boundary__
Content-Type: text/html; charset=UTF-8
Content-Disposition: inline

<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title></title>
<style>
body {
    font-family: "Myriad Pro", "Myriad", Helvetica, Arial, sans-serif;
    font-size: 12pt;
    margin: 0px;
}
</style>
</head>
<body>
<p>Hello,</p>

<p>We have received a request to use this email address with a matrix.org
identity server. If this was you who made this request, you may use the
following link to complete the verification of your email address:</p>

<p><a href="__link__">Complete email verification</a></p>

<p>...or copy this link into your web browser:</p>

<p>__link__</p>

<p>If your client requires a code, the code is __token__</p>

<p>If you aren't aware of making such a request, please disregard this
email.</p>

<br>
<p>About Matrix:</p>

<p>Matrix is an open standard for interoperable, decentralised, real-time communication
over IP. It can be used to power Instant Messaging, VoIP/WebRTC signalling, Internet
of Things communication - or anywhere you need a standard HTTP API for publishing and
subscribing to data whilst tracking the conversation history.</p>

<p>Matrix defines the standard, and provides open source reference implementations of
Matrix-compatible Servers, Clients, Client SDKs and Application Services to help you
create new communication solutions or extend the capabilities and reach of existing ones.</p>

</body>
</html>

--__multipart_boundary__--

Date: __date__
From: __from__
To: __to__
Message-ID: __messageid__
Subject: Invitation to join Matrix
MIME-Version: 1.0
Content-Type: multipart/alternative;
    boundary="__multipart_boundary__"

--__multipart_boundary__
Content-Type: text/plain; charset=UTF-8
Content-Disposition: inline
Hello,

You have been invited to join the Matrix platform by __inviter_name__. If you wish to accept this invitation and register on Matrix, please use the following link:

__link__

If your client requires a code, the code is __token__

Invitation Details:
- Inviter: __inviter_name__
- Room Name: __room_name__
- Room Type: __room_type__
- Room Avatar: __room_avatar__


About Matrix:
Matrix is an open standard for interoperable, decentralised, real-time communication over IP. It can be used to power Instant Messaging, VoIP/WebRTC signalling, Internet of Things communication - or anywhere you need a standard HTTP API for publishing and subscribing to data whilst tracking the conversation history.

Matrix defines the standard, and provides open source reference implementations of Matrix-compatible Servers, Clients, Client SDKs and Application Services to help you create new communication solutions or extend the capabilities and reach of existing ones.

--__multipart_boundary__
Content-Type: text/html; charset=UTF-8
Content-Disposition: inline

<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Invitation to join Matrix</title>
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

<p>You have been invited to join the Matrix platform by __inviter_name__. If you wish to accept this invitation and register on Matrix, please use the following link:</p>

<p><a href="__link__">Join Matrix</a></p>

<p>...or copy this link into your web browser:</p>

<p>__link__</p>

<p>If your client requires a code, the code is __token__</p>

<br>
<p>Invitation Details:</p>
<ul>
<li><strong>Inviter:</strong> __inviter_name__ (display name: __inviter_display_name__)</li>
<li><strong>Room Name:</strong> __room_name__</li>
<li><strong>Room Type:</strong> __room_type__</li>
<li><strong>Room Avatar:</strong> <img src="__room_avatar__" alt="Room Avatar" /></li>
</ul>

<br>
<p>About Matrix:</p>

<p>Matrix is an open standard for interoperable, decentralised, real-time communication over IP. It can be used to power Instant Messaging, VoIP/WebRTC signalling, Internet of Things communication - or anywhere you need a standard HTTP API for publishing and subscribing to data whilst tracking the conversation history.</p>

<p>Matrix defines the standard, and provides open source reference implementations of Matrix-compatible Servers, Clients, Client SDKs and Application Services to help you create new communication solutions or extend the capabilities and reach of existing ones.</p>

</body>
</html>

--__multipart_boundary__--


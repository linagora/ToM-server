Date: __date__
From: __from__
To: __to__
Message-ID: __messageid__
Subject: Invitation to join a Matrix room
MIME-Version: 1.0
Content-Type: multipart/alternative;
    boundary="__multipart_boundary__"

--__multipart_boundary__
Content-Type: text/plain; charset=UTF-8
Content-Disposition: inline
Hello,

You have been invited to join the __room_name__ Matrix room by __inviter_name__.
Please click on the following link to accept the invitation: __link__

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
<title>Invitation to join a Matrix room</title>
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

<p>You have been invited to join the __room_name__ Matrix room by __inviter_name__. Please click on the following link to accept the invitation: <a href="__link__">__link__</a></p>

<p>About Matrix:</p>

<p>Matrix is an open standard for interoperable, decentralised, real-time communication over IP. It can be used to power Instant Messaging, VoIP/WebRTC signalling, Internet of Things communication - or anywhere you need a standard HTTP API for publishing and subscribing to data whilst tracking the conversation history.</p>

<p>Matrix defines the standard, and provides open source reference implementations of Matrix-compatible Servers, Clients, Client SDKs and Application Services to help you create new communication solutions or extend the capabilities and reach of existing ones.</p>

</body>
</html>

--__multipart_boundary__--

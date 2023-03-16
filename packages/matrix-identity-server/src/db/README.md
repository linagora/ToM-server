# @twake/matrix-identity-server

What we have to store:

|     Object to store    |  Delay  |           Content           | Additional index |
|:----------------------:|:-------:|-----------------------------|:----------------:|
|     Access token[^1]   |  1 day  | Data given by Matrix server |      expires     |
| Mail/phone attempts[^2]|  1 day  | Mail, attempt, expires      |                  |
| Registered mails/phones|  1 day  | mail/phone, user, expires   |                  |
|    One-Time-Token      |  10 mn  | JSON object                 |      expires     |
|     Terms accepts      |  always | Version of policy accepted  |                  |


[^1]: token given after validating Matrix Server Token
[^2]: attempts to validate a phone or an email
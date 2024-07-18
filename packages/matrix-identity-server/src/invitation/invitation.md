# Extension of the Matrix specification v1.11 : adding phone ('msisdn') to valid 3pid invitation media

- the parameter media now accepts two values : 'email' and 'msisdn'
- a parameter phone is added to the request body
- a new scheme for request body parameters is adopted :

-----------------------------------------------
|                      | address : REQUIRED   |
|  medium === 'email'  |                      |
|                      | phone : OPTIONAL     |
-----------------------------------------------
|                      | address : OPTIONAL   |
|  medium === 'msisdn' |                      |
|                      | phone : REQUIRED     |
-----------------------------------------------

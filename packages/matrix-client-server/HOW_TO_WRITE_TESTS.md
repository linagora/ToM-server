**How to write tests**

__Tests organisation__ :  tests are organized relatively to their prefix in the api url. 

__Config management__ : in order to avoid conflicts between calls to the database, we chose to use one db per test file. The config to use is the registerConf.json and then in the first beforeAll it is necessary to give a new name to the db used. An example for the config management can be found in files like src/presence/presence.test.ts or src/rooms/rooms.test.ts.
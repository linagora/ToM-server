**How to use the synapses database**

__Database schema__ : go check the schema in the synapses element-hq repository on Github (insert link). 
NB : This schema includes deprecated tables for backwart compatibility. One should search in the synapses repository any occurence of 'a_table_name' or 'table=a_table_name' in order to see how synapses uses the table that might be useful. 

__List of used tables for the moment__ : given the current development of the server, not all tables from synapses have been added to our project. The list of tables used for the moment can be found in the type Collections in src/matrixDb/index.ts.

__How to add a new table__ : when it is necessary to use a new table that is not currently used, one must add it to the type Collections in src/matrixDb/index.ts. For test purposes, one must also add the line used to create the table in the matrixDbQueries in src/testData/buildUserDb.ts.

__How to run queries on the db (get, insert, upsert, delete etc...)__ : there are many methods that achieve actions on the db. They are described in src/matrixDb/index.ts. They have to be both implemented in sqlite.ts and pg.ts. Some methods may be defined in the folder  matrix-identity server/src/db.


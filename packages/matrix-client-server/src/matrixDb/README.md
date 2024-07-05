# @twake/matrix-client-server

The goal of the matrixDb database is to provide a link to a potentially existing Synapse database.

The clientServer would be able to acces the database in READWRITE mode.

Then naturally we are using the table already implemented in the Synapses db (cf : https://github.com/element-hq/synapse/blob/develop/synapse/storage/schema/main/full_schemas/72/full.sql.sqlite)

Following are the most used tables as well as there fields.

events : 1 | 2 | 3 | 4 | 
....


Some details on the values infered.

It is not always specified what kind of value a field will take
When a decision had to be taken we specified our choices :
    - kcwnekc -> jwnkdcm
    - djcnkwcdm -> jwkdnc
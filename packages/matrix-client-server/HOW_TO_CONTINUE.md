**What has been done in Client Server**


__Client Authentication__ : blablabla

__Capabilities__ :

__Events__ : The complete management of events has not been fully implemented. The different GET APIs have been implemented but the mecanism behind sending events requires to be developed. The redaction algorithm can be found in utils/event.ts. The /sync API which is central to the project is still being developed - it requires many additional features that were partially implemented.

__Rooms__ : The management of rooms is closely intertwined with the mecanism of sending events so it is still in progress.

__Modules__ : Many API's concerning different modules have been implemented. Beware that some TODO may remain if the complete implementation relied on features that were not developed at the time.

__Encryption and Key management__ : nothing has been done concerning this for the moment


**How to continue from there ?**

__Read fully the Matrix Client Server spec__ : reading and fully understanding the spec is absolutely necessary to start developing the missing features in Client Server. Many of the remaining tasks are closely intertwined and require a precise understanding of the general functionning in order to be implemented.

__Check out and understand the synapses implementation__ : since the main constraint of this project is to be able to reuse the database schema from the synapses project, it is necessary to study deeply how the spec is implemented in their project. 
1) each time you want to use a table in their db - go checkout all the calls done to this table in their repository (with searching for "table_name" or "table='table_name") to understand how this table is intended to work
2) for every component of their code, all the db interactions are developed in the folder synapse/storage/databases/main so it is necessary to see how they use their db to avoid missing key components
3) for the more general behaviour of their code, go checkout the different handlers they implemented in the folder synapse/handlers 

__How to implement the sync API__ : implementing the /sync api resquires to implement all the general behaviour of sending events /notifiyng people when new events have been sent / ensure the coherence of the different processes etc. A basis for the use of filters can be found in the utils/filter.ts file. A small basis for events can be found in the utils/events.ts file. 
More generally it is necessary to understand precisely how synapses chose to function to be able to reproduce some behaviours we need to copy in order to use their db. 

__Concerning existing APIs__ : the APIs that have been implemented may not be complete for the moment. They fully correspond to the expected behaviour described by the spec but they may not achieve internal actions that could be required for the correct implementation of further APIs (like /sync for instance). Therefore while developing the remaining behaviours it will be necessary to adapt and fix the behaviour of certain existing APIs.

__Concerning the use of multiple workers in synapses__ : synapses uses several different workers that each do a part of the work but this is not the case in our architecture. Therefore we do not have to ensure coherence between the different workers like synapses does. Nevertheless since the server-server (federation service) is not yet implemented, it is important to keep in mind that ensuring coherence and a correct circulation of informations between all the servers is a big issue that must be tackled in order to finish the implementation.

__Concerning the use of multiple writers for streams in synapses__ : synapses uses different writers to handle event streams and always needs to ensure that each writer is correctly following the stream and that each worker shares coherent data with other writers. For the moment the premisse of stream management that has been implemented relies on only one writer and does not tackle these issues. This is not a final choice (cf. utils/idManager.md) and surely a multi-writer stream management must be considered in the future.



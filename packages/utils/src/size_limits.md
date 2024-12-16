## General Constraints

- The complete event MUST NOT be larger than 65536 bytes when formatted with the federation event format, including any signatures, and encoded as Canonical JSON.

## Size Restrictions Per Key

| Key        | Maximum Size                                                     |
|------------|------------------------------------------------------------------|
| sender     | 255 bytes (including the `@` sigil and the domain)               |
| room_id    | 255 bytes (including the `!` sigil and the domain)               |
| state_key  | 255 bytes                                                        |
| type       | 255 bytes                                                        |
| event_id   | 255 bytes (including the `$` sigil and the domain where present) | 

Some event types have additional size restrictions which are specified in the description of the event. Additional restrictions exist also for specific room versions. Additional keys have no limit other than that implied by the total 64 KiB limit on events.

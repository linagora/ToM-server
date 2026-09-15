# Changelog

## [v2.0.0](https://github.com/linagora/tom-server/compare/v1.0.1...ab03bad73d0b77ef129d57b642551b1eb93628bf) (2026-09-15)

### ⚠ BREAKING CHANGE

* addressbook router now requires userDB and userInfoService parameters

### Features

* **devenv:** features a minimal dev setup - SSO lacking
([12f24f1](https://github.com/linagora/tom-server/commit/12f24f1aa131975f8680ecebd458e14c3bf14559))
* **utils:** add getServerNameFromMatrixId helper function
([4d13ff8](https://github.com/linagora/tom-server/commit/4d13ff8cb51dc445b69f90e3e99bf6845e9219ac))
* **tom-server/user-info-api:** add batch getMany method and optimize
addressbook enrichment
([1563047](https://github.com/linagora/tom-server/commit/1563047cf1d0c56f62c9301f61327489962fe848))
* **tom-server/addressbook-api:** add middleware to enrich contacts with
userinfo
([38f2f58](https://github.com/linagora/tom-server/commit/38f2f586dcc53f49d9b8ea9f9ceedac8428cec76))
* **tom-server/userinfo:** add active field support to user information
([777207d](https://github.com/linagora/tom-server/commit/777207db5f40b616706d0519a90b1cfcd0ca29b2))
* **tom-server/addressbook-api:** injects userdb into addressbook
([3c54bb2](https://github.com/linagora/tom-server/commit/3c54bb2a715385a9f1031ad65cf8964c546557e8))
* **tom-server:** add initialization logging to UserInfoService
([bb73bc5](https://github.com/linagora/tom-server/commit/bb73bc5e266f4eca92eb181ce3c772891c88f37d))
* **db:** add UNIQUE constraint on addressbooks.owner field
([08e212f](https://github.com/linagora/tom-server/commit/08e212f3565f96f0b78938a04fc6d436817d9f55))
* **tom-server:** implement singleton pattern for AddressbookService and
UserInfoService
([07ac039](https://github.com/linagora/tom-server/commit/07ac039f906a505c8bfaeefac05abcf1bb9af41d))
* **tom-server/user-info-api:** adds `workplaceFqdn` property
([5f0d1b6](https://github.com/linagora/tom-server/commit/5f0d1b643bd68ff5c2bdf9ca5eb6c22754a89ef7))
* **tom-server/identity-server:** follows user directory feature flag
([8c385e2](https://github.com/linagora/tom-server/commit/8c385e226489d52d4827eeb1d4b79402d63c1571))
* **tom-server:** creates a feature flag controling search in the mxDB
([d2ab152](https://github.com/linagora/tom-server/commit/d2ab15248a35b38205de6135399589db98433a25))
* **tom-server/invitation:** uses inviter display name if available
([90b2298](https://github.com/linagora/tom-server/commit/90b2298fb2f0fe91697b9beeb945dcc224f10b28))
* **tom-server/invitation:** uses minified html but keep full for debugging
([0119200](https://github.com/linagora/tom-server/commit/011920038297e2d849b2300ef7239a217f41921a))
* **tom-server/invitation:** attaches images for better mail clients support
([7f30b8b](https://github.com/linagora/tom-server/commit/7f30b8bcc84cdebb5be0f1441cd8c93c23ea0c8c))
* **docker:** update compose w/ a smtp service
([dbe9c99](https://github.com/linagora/tom-server/commit/dbe9c99f71f0fcf676ef7f657c04a375f4275689))
* **utils:** adds Matrix ID validation
([feb38a4](https://github.com/linagora/tom-server/commit/feb38a4825d9ec5e87034f0b6abe818d049be57b))
* **matrix-identity-server/matrixDb:** enables match function
([3de36aa](https://github.com/linagora/tom-server/commit/3de36aa849ca2f3e7e538b29564c3280acd51b80))
* **tom-server:** reads user default visibility config from env
([d09fd27](https://github.com/linagora/tom-server/commit/d09fd270d1e7a9835ac6612790ba41a83c33e2dc))
* **tom-server:** adds default visibility in config files
([0966504](https://github.com/linagora/tom-server/commit/09665046d4ba1d7abd28ce6e7b69f83f117a1213))
* **tom-server/user-info-api:** drafts route to get visibility settings
([ed3bde0](https://github.com/linagora/tom-server/commit/ed3bde04e611c91cd5fd7cab2ee33e9005cd56d9))
* **tom-server/user-info-api:** aggregates info from address book
([62224b9](https://github.com/linagora/tom-server/commit/62224b93e97afbc5c81f2676acc7f7c53e34d0ec))
* **user-info:** extra controller branch coverage
([0924fe5](https://github.com/linagora/tom-server/commit/0924fe5f26fa2f59d887997fd680b199514a78af))
* **user-info:** add edge‑case tests
([5fd0578](https://github.com/linagora/tom-server/commit/5fd05784760abfc2739ca6310100124444596820))
* **tom-server/user-info-api:** profile settings db table
([131f9b8](https://github.com/linagora/tom-server/commit/131f9b80b9f6a92ed64035ce032be1462ff28e95))
* **tom-server/user-info-api:** user profile visibility
([5d30484](https://github.com/linagora/tom-server/commit/5d304846fd207e124692affbabe2b63aee034dad))
* **tom-server:** new invitation email template
([e6eb6b5](https://github.com/linagora/tom-server/commit/e6eb6b558b1d9f2909b983a450c4158ffa19fee0))
* **well-known:** merge with matrix server config and adding support contact
([32a64a4](https://github.com/linagora/tom-server/commit/32a64a4996def4b4012fb50200bda2cade5f3d0e))
* **well-known:** provides common settings application url
([6838c6b](https://github.com/linagora/tom-server/commit/6838c6b3ffbdf4226d61861b14f2b70dd7d07d82))
* make dead letter optional
([2d1373c](https://github.com/linagora/tom-server/commit/2d1373cf458943e8e89a82e977e063cfb704b65b))
* **matrix-identity-server:** query profiles
([fc9828e](https://github.com/linagora/tom-server/commit/fc9828e103f4683e194c559a4957c3c26a035a59))
* **tom-server:** new user info api
([36e93d2](https://github.com/linagora/tom-server/commit/36e93d221015ca637f1e2caa4a35d10cb3b67c1b))
* **well-known:** updates app.twake.chat content w/ cs information
([3380598](https://github.com/linagora/tom-server/commit/3380598b0c7ad6d1ac29a22933cebb02ea2eabc4))
* using json field for settings
([72214b0](https://github.com/linagora/tom-server/commit/72214b01524b35a2a383bbd0175f8bff3b6ba38c))
* added routing key for the queue
([547311b](https://github.com/linagora/tom-server/commit/547311bf4a5eb7c0e351be5ea790a00ced6d6a55))
* **tom-server:** removing unused middleware in matrix-api
([922b59b](https://github.com/linagora/tom-server/commit/922b59badc312a47573a1df70c4ff0688c17665b))
* **tom-server:** error codes in matrix-api from utils
([df4fe78](https://github.com/linagora/tom-server/commit/df4fe7858eadbc8a4285a0ad39b878ce478c80c6))
* **tom-server/admin-settings-api:** get avatar from cozy as png
([dce253e](https://github.com/linagora/tom-server/commit/dce253eaac56a328a671e5863f88f5211f72dd0f))
* **common-settings:** added tests + refactoring
([64f9663](https://github.com/linagora/tom-server/commit/64f9663590d2771ce9e70ff620c09e5d3edf7c1b))
* **tom-server:** new display name endpoint
([e84a892](https://github.com/linagora/tom-server/commit/e84a892af6d2c164a2ebaeb0e42c31f4580c5353))
* new features config
([df00151](https://github.com/linagora/tom-server/commit/df001513b0897297a5ed2e55af21d71349ead388))
* **common-settings:** use config object, exchange and queue options for
rabbitmq connection
([405cbd9](https://github.com/linagora/tom-server/commit/405cbd9e469bc7f8a183d3b84f27472f7802981f))
* **amqp-connector:** use config object
([4d957a6](https://github.com/linagora/tom-server/commit/4d957a6674c04e40cc1a9abd9e7e29a9de1fdaac))
* **docker:** switch base image to debian:stable-slim
([ad75225](https://github.com/linagora/tom-server/commit/ad75225ea6db4712ae8100b2c87f2def06ff7741))
* **docker:** switch base image to debian:stable-slim
([3618acb](https://github.com/linagora/tom-server/commit/3618acbba40f5cd2686746d6ffd98874bcb2c7db))
* **amqp-connector:** reinstating tests
([8bffee8](https://github.com/linagora/tom-server/commit/8bffee86286e097e6fe1e713266349f3676b6f8c))
* **docker:** switch base image to debian:stable-slim
([3ccba9c](https://github.com/linagora/tom-server/commit/3ccba9ce1b76e164a5d16481e51309681e0cf819))
* **tom-server:** updated test data
([d9398b7](https://github.com/linagora/tom-server/commit/d9398b7396c22c28edcad1e0142aa87050674448))
* **amqp-connector:** updated tests
([b50ac88](https://github.com/linagora/tom-server/commit/b50ac88c1cd47c535c01fd3ae5df3d43e8db15ad))
* **amqp-connector:** disabling tests
([20edb2c](https://github.com/linagora/tom-server/commit/20edb2c95fb6b6ff36ffd94f10c6211655b21b24))
* **amqp-connector:** jest config/skip some tests
([4575303](https://github.com/linagora/tom-server/commit/4575303c0a8bb62568dec7fdad4731e791e8548e))
* **matrix-invite:** playwright config
([321bdc1](https://github.com/linagora/tom-server/commit/321bdc10cf951f80f98f4139842993b69bc5d507))
* updated dependencies and common settings service instance name
([2658806](https://github.com/linagora/tom-server/commit/26588069db45d0fa7fd2ded2fc0d829f0fc9090c))
* **common-settings:** added db to track user settings
([625988a](https://github.com/linagora/tom-server/commit/625988a6373df96452f050c158d84ae9c0299963))
* **common-settings:** updated README
([fb72200](https://github.com/linagora/tom-server/commit/fb72200330263e16426ff666ed3872ed9ab995dd))
* refactor amqp connector into it's own package and handling user information
update with admin api
([58233ff](https://github.com/linagora/tom-server/commit/58233ffbb9155633309da119894efe245896f5ba))
* **common-settings-connector:** common settings connector and admin settings
api
([b57e1f8](https://github.com/linagora/tom-server/commit/b57e1f82fe41700c17fec4666a2b0757225751d4))
* **amqp-connector:** binding queue to the exechnage
([63c846c](https://github.com/linagora/tom-server/commit/63c846c3fb4b4eee8ac114b5e53e2f57f3743911))
* **logger:** using the new config parser / updating test suite
([2630d74](https://github.com/linagora/tom-server/commit/2630d74307ea3b486adf89f719eb607d9195d6ec))
* **config-parser:** use the old parser by default
([73c24ec](https://github.com/linagora/tom-server/commit/73c24ec719a852f1b1d83291c3dafb8f518ca6d5))
* **configParser:** defines a propper type for Configuration
([26508af](https://github.com/linagora/tom-server/commit/26508afbe0d7b2da99a54581a465186cd085b123))
* **configParser:** creates explicit error types
([eaec2c1](https://github.com/linagora/tom-server/commit/eaec2c1eafeb8c42c8bde9fb4d8cde571d9e13dd))
* **configParser:** implements a basic type coercion system
([fe60f95](https://github.com/linagora/tom-server/commit/fe60f95bdff62caf1a262f8310b09f6f197ca58b))
* **amqp-connector:** updated docker compose file with rabbitmq service
([2c1f35c](https://github.com/linagora/tom-server/commit/2c1f35c92712c4639e48a2c38acf3d2c9bbaa6c2))
* **amqp-connector:** implement a basic amqp connector
([f37d918](https://github.com/linagora/tom-server/commit/f37d9180d877d125f54d03763bf1ea46562983e9))
* **matrix-identity-server:** uses the configured ldap_filter
([984de29](https://github.com/linagora/tom-server/commit/984de29c998d5e3aca7712319cfba01a524edda0))
* **toMatrixId:** verifies grammar for localpart and servername
([d7c080f](https://github.com/linagora/tom-server/commit/d7c080fb263c7d3ab712990db8a8dc3977c6f378))
* parse additional features env flag
([128e21a](https://github.com/linagora/tom-server/commit/128e21a83e0601c9e8c41fb8b028dcc82c4e0f20))
* parse cron job service env flag
([5df0947](https://github.com/linagora/tom-server/commit/5df094731dd74ce10058553c7ad809a14adfade5))
* override room owner power level after room creation
([7cfb405](https://github.com/linagora/tom-server/commit/7cfb405c56a5b56df0c24a914a574e7951f12c99))
* override power levels on room creation
([4be76e5](https://github.com/linagora/tom-server/commit/4be76e5382f52ebc651cdc7dfc312607af143fcf))
* updated routing for create room internal on dev
([f54e9e6](https://github.com/linagora/tom-server/commit/f54e9e61421e3d1fba74b4df59b3b599e5f2ff25))
* always allows `lookup/match`
([20d86cc](https://github.com/linagora/tom-server/commit/20d86cc2863330c7491114a908d6fffcc23b0c85))
* merge addressbook with ldap search
([ee09a9b](https://github.com/linagora/tom-server/commit/ee09a9bb856c36fc9264c7f1daffa2408056ab8a))
* synapse-admin service deployment
([219e024](https://github.com/linagora/tom-server/commit/219e02435398c393b8849084a6fc56e5a3e921f6))
* **fed:** allow the use of trusted proxies
([041d51c](https://github.com/linagora/tom-server/commit/041d51c067c9130365eb009a84479737efda54d3))
* **identity-server:** reuse identity database from TomServer
([d895eeb](https://github.com/linagora/tom-server/commit/d895eeb2054036292b7b75d29f78c04228eab529))

### Fixes

* **db:** handle SSL config types in pg connections (#381)
([6869c9e](https://github.com/linagora/tom-server/commit/6869c9eaa2efb2c9208ebbc64b5e180ed6f05002)),
closes [#381](https://github.com/linagora/tom-server/issues/381)
* **tom-server:** landing page is not showing when ToM is a Federation node
([7a3c377](https://github.com/linagora/tom-server/commit/7a3c3774d472dd9e396a6f8acb53bb88f12a5869))
* **db:** handle SSL config types in pg connections (#356)
([d340d7d](https://github.com/linagora/tom-server/commit/d340d7de07b5b93cd8e14ccfb618f15e14e22d1c)),
closes [#356](https://github.com/linagora/tom-server/issues/356)
* **tom-server/user-info-api:** uses normalized error code
([faf4dc8](https://github.com/linagora/tom-server/commit/faf4dc8cd95d490f009e1584f5fbfc9b10a42685))
* **tom-server:** remove unsafe non-null assertions from addressbook routes
([ddc7c6a](https://github.com/linagora/tom-server/commit/ddc7c6abfc922a4605ae4cfca4d60087315efc0d))
* **tom-server:** add missing getMany controller mock in user-info-api router
tests
([6596b5e](https://github.com/linagora/tom-server/commit/6596b5e209a6aa47b8fe567d4622cf16601b725f))
* **tom-server:** add missing dependencies to addressbook router tests
([9cd5a1c](https://github.com/linagora/tom-server/commit/9cd5a1c082cf85b6ca385db4b976a5bebfcd6c16))
* **tom-server:** add missing userInfoService parameter to addressbook
middleware tests
([0212bf7](https://github.com/linagora/tom-server/commit/0212bf7c5733152c4bfc2e7a03ccd64eb3b7b512))
* **tom-server/addressbook-api:** throws when db issue during ab creation
([0e11ea6](https://github.com/linagora/tom-server/commit/0e11ea6099cd237a5f50a4fa82265f33df06c363))
* **addressbook:** add retry logic with exponential backoff for race condition
in _getOrCreateUserAddressBook
([5dd4c86](https://github.com/linagora/tom-server/commit/5dd4c86375f486181f76dc15378cd9d0650cc8a8))
* **tom-server/addressbook-api:** removes duplicates after db get
([5a0d7a8](https://github.com/linagora/tom-server/commit/5a0d7a855076736d88289969cd08925cc4c00bb2))
* **tom-server/identity-server:** returns nothing when empty predicate
([cff0869](https://github.com/linagora/tom-server/commit/cff0869cafab21a56efb1f2a033b19a7d11911a3))
* **tom-server/user-info-api:** returns a 500 UNKNOWN code if internal error
happens
([a6b8ce7](https://github.com/linagora/tom-server/commit/a6b8ce7165788a07275df904b1f7cf77be993180))
* **tom-server/user-info-api:** corrects the values returned by visibility
update service function
([4928503](https://github.com/linagora/tom-server/commit/4928503ad464e78ce56bd4b89f43a33331807e20))
* **tom-server/identity-server/lookup:** puts back missing sn field
([30c19c4](https://github.com/linagora/tom-server/commit/30c19c44e15072e289ea0548aaec0f6f91d6ca76))
* **tom-server/identity-server/lookup:** enriches users only when info exists
([42f2c5f](https://github.com/linagora/tom-server/commit/42f2c5f926d965217c2631c1f85c1f867cb530c2))
* **tom-server/identity-server/lookup:** improves _search logging and result
handling
([6d7d401](https://github.com/linagora/tom-server/commit/6d7d40100d6187582401b99174e162f0c9b4cd7c))
* **matrix-identity-server/db/pg:** updates wildcard when no predicates
([dbae31a](https://github.com/linagora/tom-server/commit/dbae31ab33854e5e4462f7014cead63a804fb418))
* **matrix-identity-server/userDB:** refines predicate when wildcard matching
([4bcd3bd](https://github.com/linagora/tom-server/commit/4bcd3bd32eaa2ad21c16a064f89438e864404b55))
* **tom-server:** coreces commaor space separated visibile fields from env var
([6061ec6](https://github.com/linagora/tom-server/commit/6061ec63f8292358e207a6f1c376e7793785e74c))
* **tom-server/identity-server:** sets givenname to first_name
([59175b2](https://github.com/linagora/tom-server/commit/59175b209c07b71e4ca1221072536409b8e8e5cd))
* **tom-server/invitation:** builds a multipart mail using nodemailer engine
([82de19b](https://github.com/linagora/tom-server/commit/82de19b4136653539a34b87cb7c0f53d0a7a513d))
* **tom-server/identity-server/lookup:** constructs returned object using user
info values
([ff1f2ab](https://github.com/linagora/tom-server/commit/ff1f2abd2454b9b1d77a39ba98d2a974bc56263f))
* **tom-server/identity-sever:** fix test/mock user info service
([7781fa8](https://github.com/linagora/tom-server/commit/7781fa81f0f8cd46fe1e504b0a71033c92d5da9d))
* **tom-server/identity-sever:** fix test/mock user info service
([e7e21ff](https://github.com/linagora/tom-server/commit/e7e21ffbaa8433f5417b0312c1d3c6ec4ecc0576))
* **tom-server/lookup:** follows optionated fields during enriching
([4f59e33](https://github.com/linagora/tom-server/commit/4f59e3362484cbde7aacdeb664f1af15725686a5))
* **tom-server/user-info-api:** corrects typos on user info object
([862e3d8](https://github.com/linagora/tom-server/commit/862e3d8b050b8ce0e66d969c092f78cdb6665949))
* **utils:** returns null when no id provided
([d5e3ece](https://github.com/linagora/tom-server/commit/d5e3ece529707a29ba72d4792c828f4a80143122))
* **tom-server/user-info-api:** reuses internal functions
([c7bc8f1](https://github.com/linagora/tom-server/commit/c7bc8f137748b2aa45db2aba7ded415421d369a7))
* **tom-server/user-info-api:** standardizes getVisibility response object
([8ab769a](https://github.com/linagora/tom-server/commit/8ab769a36a9a1ef369d8131e73254bcf2a4b9098))
* **tom-server/user-info-api:** corrects type expectation when getting user
profile settings
([39f9181](https://github.com/linagora/tom-server/commit/39f9181131c7d6d2b39a29aae2b4fe150c551e64))
* **tom-server/user-info-api:** returns 404 when nothing found
([68671d0](https://github.com/linagora/tom-server/commit/68671d0d859766bcedd0cf220ab79651e54858f7))
* **federated-identity-service:** moves id service config in test compose env
([0662fd4](https://github.com/linagora/tom-server/commit/0662fd4aadd54958d32273b6330bf414e6fe01ab))
* **tom-server:** reads config from file if exists
([942a54b](https://github.com/linagora/tom-server/commit/942a54b748d1cf4f0c1cf68ea454f326e2626140))
* logger debug mock in test
([efd99f4](https://github.com/linagora/tom-server/commit/efd99f4c8503a3ccb3de29479e9e71986e770cd9))
* **tom-server/user-info-api:** corrects visibility default behavior
([c21d82e](https://github.com/linagora/tom-server/commit/c21d82efddb7e5a289f1272d615f0e017c369345))
* **tom-server/user-info-api:** fills result with full common settings info
([d97313b](https://github.com/linagora/tom-server/commit/d97313b4697b60c0625fb8b696e8e1b947d7eaa0))
* **tom-server/user-info-api:** calls userdb no matter what
([ce135cc](https://github.com/linagora/tom-server/commit/ce135cc0df558c872d6ee90c39d8d46ca4bab138))
* **tom-server:** updates null detection and mock ordering
([9a36015](https://github.com/linagora/tom-server/commit/9a36015d8474f76e2a5e9d07d238915b8b7c7762))
* **tom-server:** follows env vars in user-service-info
([c1411ad](https://github.com/linagora/tom-server/commit/c1411adbd75b071e69f0ba2d36a52b3a5af56bf2))
* **tom-server/invitation-api:** add STOP footer for French numbers only
([ce27ae1](https://github.com/linagora/tom-server/commit/ce27ae1175b7fd14ee8a2211ea2cf81e339a7c64))
* **user-info:** sends a 400 Missing Params if no userId
([871251c](https://github.com/linagora/tom-server/commit/871251c8837fc4db0e44e4a67311f425bdbb0ec0))
* **user-info:** does not expect mails form LDAP in tests
([0d3b312](https://github.com/linagora/tom-server/commit/0d3b31228589319382473f58ba417b4bd6905da3))
* **commong-settings:** trailing slash when updating the user information
([717db17](https://github.com/linagora/tom-server/commit/717db17c311953b0b3daadbc2e4cce7cdd99e8d2))
* **tom-server:** admin settings api set fallback for user avatar
([4100902](https://github.com/linagora/tom-server/commit/4100902cf6dcb7b5929da8e21896ac17f3430855))
* **tom-server:** admin settings api payload check for profile update
([7835329](https://github.com/linagora/tom-server/commit/7835329ab985a9cf523d2969462a2c4f1c4f6ad4))
* **tom-server:** updated display name service proper response
([725e186](https://github.com/linagora/tom-server/commit/725e1863eabaf4d2eeade64796fa9e20fc1a5fa6))
* **tom-server:** updated display name service proper response
([f0cd3b9](https://github.com/linagora/tom-server/commit/f0cd3b965f1a7ffa74ba835535c949df9fd1f31f))
* **tom-server:** user info api test
([7119030](https://github.com/linagora/tom-server/commit/7119030cf4dddf1d670b87b793ef463ab66c071e))
* **user-info:** ensures proper typing and object construction
([76071a5](https://github.com/linagora/tom-server/commit/76071a577cd90e61f993cd9da5ec2ed301021ca1))
* **user-info:** returns null for no matrix profile AND no additional fetaures
([b8f7258](https://github.com/linagora/tom-server/commit/b8f7258456a4b74246686c425b7f27852eef1635))
* **user-info:** removes default values for lang and tz
([19427ad](https://github.com/linagora/tom-server/commit/19427ad61b33e2f25f8e235faab2ab07523ce9a0))
* **tom-server:** branch coverage for user info api
([4dd45c2](https://github.com/linagora/tom-server/commit/4dd45c26ea2d4c14afadef8706be28672d803bd8))
* updated ts config for test
([a1b2cee](https://github.com/linagora/tom-server/commit/a1b2ceee5f7c02e4672b89c4c46e072a5ae8f45c))
* **common-settings:** updated package.json author
([96f2400](https://github.com/linagora/tom-server/commit/96f2400b98d08df4c4020b0dac8df614e2f93a2c))
* **common-settings:** updated tests
([0dbe108](https://github.com/linagora/tom-server/commit/0dbe1086b27a471561309e1522066f16847a9925))
* **tom-server:** updated tests for admin-settings-api / added test for
matrix-api displayName
([f02e01e](https://github.com/linagora/tom-server/commit/f02e01e2f9882d07ddf6804350cb353209940587))
* **tom-server:** added tests for admin-settings-api
([825c820](https://github.com/linagora/tom-server/commit/825c820760f4c9099700b18a6b9f08a0d621eb83))
* **tom-server:** ldap test Dockerfile
([1d63f77](https://github.com/linagora/tom-server/commit/1d63f77a870b6c3af55b85415a6d3f6e0eb81d6c))
* **tom-server:** ldap test Dockerfile / test conf
([b388dba](https://github.com/linagora/tom-server/commit/b388dba1222fabd4985e88055cfa9b5e03a57ff1))
* **federated-identity-service:** ldap test Dockerfile
([6df2372](https://github.com/linagora/tom-server/commit/6df23723b2a65f6a530265e6a1d90b835c55c7ef))
* **federated-identity-service:** ldap test Dockerfile
([1bc1fcc](https://github.com/linagora/tom-server/commit/1bc1fcceed91406f7f6ece693c1a3fe1a9a28320))
* removed api calls for the common settings api
([dea8d97](https://github.com/linagora/tom-server/commit/dea8d97033102c8637e2ac37bfbd0e0705369f69))
* nack handling for failed RabbitMQ message processing
([eda0175](https://github.com/linagora/tom-server/commit/eda01758015ba2034778a01fefa7a9d1a9d66102))
* **docker:** updates the LDAP debian gpg key URL
([35a76c6](https://github.com/linagora/tom-server/commit/35a76c61ccb2c2a8d86200019d09ef163c541523))
* **config-parser:** laod default config for legacy parser
([ce30582](https://github.com/linagora/tom-server/commit/ce30582de369854cb6dc77e1e31d52b95e024289))
* **config-parser:** exclude legacy parser from test coverage
([64dcd29](https://github.com/linagora/tom-server/commit/64dcd296e4dc9e5245c5ef4bb17c89eaf47f116a))
* **configParser:** mitigates the empty env vars issue
([550f4db](https://github.com/linagora/tom-server/commit/550f4db01c0e92c624605f18fa7ce210daadf6f0))
* **configParser:** expects an error on empty env vars
([8a4076a](https://github.com/linagora/tom-server/commit/8a4076a8dd90bc717bce13285c0929bb9908e91b))
* **configParser:** handles correctly required config keys
([ec122bb](https://github.com/linagora/tom-server/commit/ec122bbad93a4109c97f072fb3137916a640030c))
* disable automatic env-based overrides when loading config
([a136766](https://github.com/linagora/tom-server/commit/a136766d50325f145956e86faf405604dab8d790))
* amqplib dependency install
([30a957d](https://github.com/linagora/tom-server/commit/30a957dd075b4ef09037d6faada7d0c7535dce22))
* **tom-server:** changes v for row from previous commit
([7f62d5b](https://github.com/linagora/tom-server/commit/7f62d5bdaedfc5c76df711fb3df0f4d60c05bf95))
* **tom-server:** adds try..catch around toMstrixId while matching Address
Book
([745fdab](https://github.com/linagora/tom-server/commit/745fdabf7dcc396cc95ffd58fbbad2cda21068c4))
* **tom-server:** handles toMatrixId exceptions
([91abf32](https://github.com/linagora/tom-server/commit/91abf32c12d901d6226ec301e97362c0e845a0b7))
* **toMatrixId:** does not allow double dot in url - e.g. example..com
([85c2553](https://github.com/linagora/tom-server/commit/85c2553544a08512e4b05e0bb0c7f1b7fb3098c4))
* **tom:** sets dc=example,dc=com for integration tests
([b800b36](https://github.com/linagora/tom-server/commit/b800b360ce275f25a366e6b85a002839fc065c2d))
* **toMatrixId:** ensures function is called with correctly typed arguments
([e0e2416](https://github.com/linagora/tom-server/commit/e0e2416dbd57d1a5e526f0733f003514b84aef7a))
* **tom:** filters user list when fetching userdb to ensure all entries have a
uid
([6d15841](https://github.com/linagora/tom-server/commit/6d158410265043806e620968be0a1df94b443795))
* **createRoom:** tests are checking user levels
([95e5a27](https://github.com/linagora/tom-server/commit/95e5a270f3137ee30eb9cdefd28ae536266d05f5))
* **createRoom:** applies full room powerlevel when owner demotion
([b7437f6](https://github.com/linagora/tom-server/commit/b7437f654920ea328c6e96078619c5309c5f97af))
* removed hard coded power levels
([fd89a74](https://github.com/linagora/tom-server/commit/fd89a7437bc5ae3321e113d561bf7aee79e92c41))
* controller test auth mock
([ba70eeb](https://github.com/linagora/tom-server/commit/ba70eeb1151be21fdeb1bf5f1cfa9bcfc68cdb3e))
* e2e test logger mock
([87f886f](https://github.com/linagora/tom-server/commit/87f886fb925770fcf51168244e643485404d1eae))
* added room owner to e2e tests
([4d39244](https://github.com/linagora/tom-server/commit/4d39244f495c158ba7c4a36ddddf0259cb8df6a7))
* **createRoom:** sets correct permissions for invited users, members already
declared, and creator
([9cf15dd](https://github.com/linagora/tom-server/commit/9cf15dd0b2a63970ccd5998c73d32952d30df579))
* **compose:** use MATRIX_INTERNAL_HOST for createRoom API
([08a3c67](https://github.com/linagora/tom-server/commit/08a3c67f6ad362bf20f74666e3f02d5b0411f127))
* **cron:** MatrixDB might not be connected
([6874246](https://github.com/linagora/tom-server/commit/6874246656ecf82f7714693ea46ae6a4ba37a28c))
* **server:** remove extra parameter
([786ff16](https://github.com/linagora/tom-server/commit/786ff16924bed59a94e25ef1d91752481c726373))
* **cron:** not start cron if already started
([5eb95ad](https://github.com/linagora/tom-server/commit/5eb95ad884989374203a0c58fa8a2f7b600149d0))

### v1.0.1 (2024-07-18)

#### Features

* add search endpoint
([8369732](https://github.com/linagora/tom-server/commit/836973261f49f127fa6e38b0f9708cde7d030c23))
* add endpoint to restore opensearch indexes manually
([33205e5](https://github.com/linagora/tom-server/commit/33205e585d950ba832dae084aba8d27e6bba7d14))
* handle events related to messages and rooms
([c66fd15](https://github.com/linagora/tom-server/commit/c66fd15fa612f3249f83b77cad9771cabadff48c))
* init tom indexes in opensearch instance
([4db1522](https://github.com/linagora/tom-server/commit/4db15224e628ff41a85d8a6476af89303401a028))
* add rate limiting on endpoints with authentication
([13366bd](https://github.com/linagora/tom-server/commit/13366bd357cde250d176a1caa1f16554d121dcfe)),
closes [#16](https://github.com/linagora/tom-server/issues/16)
* set the complete ci workflow
([1374b9e](https://github.com/linagora/tom-server/commit/1374b9e978cf890a0512a0ce4a1d98a93622ee72))
* add hashes_rate_limit in federation-server package
([a86ab90](https://github.com/linagora/tom-server/commit/a86ab90475701cdde5666d6416b09c29385b433a)),
closes [#1](https://github.com/linagora/tom-server/issues/1)
* add hashes_rate_limit in matrix-identity-server package
([0227cad](https://github.com/linagora/tom-server/commit/0227cad57a8e5eabfa53bce23dd3b60a39c39a73))
* add hashes_rate_limit in tom-server package configuration
([2f82c71](https://github.com/linagora/tom-server/commit/2f82c71bc9a22b9ce8e1d8b9c5a194507bd41fb6))
* federation server handled multiple hashes  depending on pepper for same
entry
([3c1be5b](https://github.com/linagora/tom-server/commit/3c1be5baf5f7c618559dd768695ec63882503c45))
* db delete element checking muliple conditions
([cd0c403](https://github.com/linagora/tom-server/commit/cd0c403b6765253519ca6f65caed36dc95ac4c37))
* matrix identity server push all possible hashes to fed server
([90a570d](https://github.com/linagora/tom-server/commit/90a570df5d8f3c1a88551bf69681689cf64f1667))
* FD server must store origin server with port
([5096f15](https://github.com/linagora/tom-server/commit/5096f151392637fa67cd41dbb15966fd87bbe372)),
closes [#99](https://github.com/linagora/tom-server/issues/99)
* allow matrix-identity-server to push hashes on several federation servers
([87f1875](https://github.com/linagora/tom-server/commit/87f187569b202ccff86ebe7ca406bbed0e4010a2))
* network ip address as trusted ip
([28e0473](https://github.com/linagora/tom-server/commit/28e04736c2f70fa9d593240315f14f21467b6bb1))
* handle matrix address in lookup with autocompletion
([644e1f3](https://github.com/linagora/tom-server/commit/644e1f3ae14ebf50cb3eaec7f17871ba5be5ef96)),
closes [#92](https://github.com/linagora/tom-server/issues/92)
* federation server tests setup
([59a2c78](https://github.com/linagora/tom-server/commit/59a2c78ee57a1b70ae85b69bbf8e86245951350c))
* post hashes to federation server cron task
([b5632eb](https://github.com/linagora/tom-server/commit/b5632eb4d00e724827b30cb21fbd0d2b3935a5a0))
* lookup endpoint
([044ca40](https://github.com/linagora/tom-server/commit/044ca4053315e178d6c54af8bcf680753efe4276))
* lookups endpoint
([c2a6692](https://github.com/linagora/tom-server/commit/c2a669220c0386525c082c90b6399e3eaeb528f4))
* hash_details endpoint
([bccfea3](https://github.com/linagora/tom-server/commit/bccfea328b6d1114a10bc3e18a57feeab757ada9))
* handle errors and bad api calls
([4e6e126](https://github.com/linagora/tom-server/commit/4e6e1267050a6b76e8b8c29ef8f0296a79e7ddbb))
* federation server detail in tom-server well-known
([42ffb60](https://github.com/linagora/tom-server/commit/42ffb605744e5c36125db702cb49692e0e4304ce))
* init federation server and its database
([495c1ab](https://github.com/linagora/tom-server/commit/495c1ab99fcfcc0b9caad598b366abb56c54a6d7))
* handle users who leave automatic channel
([0bb6d59](https://github.com/linagora/tom-server/commit/0bb6d592f535cce30d915cb36b2610b8ffc2a2f8))
* add users levels on room creation
([34b9f83](https://github.com/linagora/tom-server/commit/34b9f8346cefc5ff957561e020c0a74c5dc6e994))
* test enable_company_features parameter
([aaa4fb0](https://github.com/linagora/tom-server/commit/aaa4fb07d7a94df6b6eced22947606bc64190fd0)),
closes [#63](https://github.com/linagora/tom-server/issues/63)
* introduce enable_company_features parameter
([093c720](https://github.com/linagora/tom-server/commit/093c7208903cb152ddd66fd27a0ddecdcd7c8507))
* integrate logger in tom-server package
([b191e21](https://github.com/linagora/tom-server/commit/b191e21c92a9a9f967a67f4cf8f0739a2a51c7cc))
* integrate logger in matrix-identity-server package
([0cb2ecf](https://github.com/linagora/tom-server/commit/0cb2ecf28818859fa1f34e5149843a44f9157f6d))
* integrate logger in matrix-application-server package
([d9aa59f](https://github.com/linagora/tom-server/commit/d9aa59f0d5446fca9390b44a9d2f50a89bb7bd31))
* add format configuration field
([507f175](https://github.com/linagora/tom-server/commit/507f175a6f5b1646f8f720064672853680c49a68))
* add transports configuration fields
([5d6670d](https://github.com/linagora/tom-server/commit/5d6670d5e198402e4dd1e3c728b48282709d80e8))
* add checks for basic configuration fields
([e6e1ddd](https://github.com/linagora/tom-server/commit/e6e1ddd5cb7dba62257c25291246219abf6b8bd4))
* add basic configuration fields
([a3c80b9](https://github.com/linagora/tom-server/commit/a3c80b9e7c76d8778ec8968a82b797192f3c22ab))
* promise with retry strategy package
([ad9249f](https://github.com/linagora/tom-server/commit/ad9249fb116bd68465a66152775f5503e966ba26))
* force join on login
([bf2132a](https://github.com/linagora/tom-server/commit/bf2132ab05b8412132be0578e70a9527d1372956))
* create room and force join for users matching filter
([6468c2c](https://github.com/linagora/tom-server/commit/6468c2ca2d28e495294bdb43ee0c5f30def85165))
* application server auth and validation middlewares
([90c492a](https://github.com/linagora/tom-server/commit/90c492a8ebdf478147b623e9b889e52d7f484d82))
* define all possible matrix errors code in @twake/server
([de558e2](https://github.com/linagora/tom-server/commit/de558e23eced7357c78a45d53bc6c01f3836afe5))
* add application service in @twake/server
([d06140e](https://github.com/linagora/tom-server/commit/d06140e03699e1dadd5b7980c3451aa9edb66351))
* application service handles ephemeral events
([c314d54](https://github.com/linagora/tom-server/commit/c314d546dc611d3b7f9aa41f24ba34e96638eb6c))
* allow custom auth middleware and validators
([6ac2923](https://github.com/linagora/tom-server/commit/6ac292369b245a61c41b8dc8823fcd1145153c21))
* add 'on' method to matrix-application-server
([da35737](https://github.com/linagora/tom-server/commit/da3573771f6a84f1c3c47bde15b05eff6780e61a))
* basic queries endpoints implementation
([458d4ab](https://github.com/linagora/tom-server/commit/458d4ab86faa139032f85a205c44df1be92f1cff)),
closes [#52](https://github.com/linagora/tom-server/issues/52)
* update validation middleware
([97fefed](https://github.com/linagora/tom-server/commit/97fefed3073e03705ac2162e51e2644c64766f79))
* add 401 error
([6f4647a](https://github.com/linagora/tom-server/commit/6f4647a9e99ae6555dafd12aa2eb9647462410cd))
* add example for matrix-application-server
([dfb4447](https://github.com/linagora/tom-server/commit/dfb4447509012487a91b35b4defc730b605f72fe))
* legacy endpoint handler
([e429872](https://github.com/linagora/tom-server/commit/e4298725400aa20b15d40cbbf8aee259b79da669))
* basic transactions endpoint implementation
([29c3b43](https://github.com/linagora/tom-server/commit/29c3b430e50a57bb67954bcd4b3e207a24f23851))
* validation middleware for request
([6d9d846](https://github.com/linagora/tom-server/commit/6d9d8464a17bc9ddf601e0b10cdc7a1749aac8af))
* authentication of matrix homeserver
([350e8ab](https://github.com/linagora/tom-server/commit/350e8ab6ce16a26dfbee63b1047a84e651d8e4ef))
* method with basics middlewares
([41fafa8](https://github.com/linagora/tom-server/commit/41fafa85100820f52483759ad76872b18931e043))
* add registration of application server
([e20d20e](https://github.com/linagora/tom-server/commit/e20d20ed0a0e564d3290ac2f47caff2127656aae))
* use configuration file for matrix-application-server
([4fefbfb](https://github.com/linagora/tom-server/commit/4fefbfbfa26d976589d47eba708ed22339a7c67d))
* add error handler
([5614363](https://github.com/linagora/tom-server/commit/56143638cb98e2e3d9e223258ec42fa8b514e151))
* init matrix-application-server package
([6093446](https://github.com/linagora/tom-server/commit/609344664f605b0d6b504af1b471e80aa74cbb9b))
* vault api uses identity-server authenticate method
([e82e617](https://github.com/linagora/tom-server/commit/e82e617d6888d957b40cfda831628c7b06c06414)),
closes [#41](https://github.com/linagora/tom-server/issues/41)
* add .well-known endpoint
([f116948](https://github.com/linagora/tom-server/commit/f116948a737eac7b78481a1196c1462c0feb47e9))
* add vault inside server.mjs
([08f8437](https://github.com/linagora/tom-server/commit/08f843785bf2d4af57f2961b78e3bc0005d7198b)),
closes [#38](https://github.com/linagora/tom-server/issues/38)
* add matrix token to authenticate method
([28c3f97](https://github.com/linagora/tom-server/commit/28c3f97fbb576d1dac3850d5d4788581c7089fcb))
* make sqlite class work with additionnal matrix_server field
([4737e8b](https://github.com/linagora/tom-server/commit/4737e8bd8cf2f896256ebb0ae09b1ccfecc95515))
* export type of Matrix server response
([9abb348](https://github.com/linagora/tom-server/commit/9abb348654544e0c6d99cc0f7e0a6b4fb7e1c1a5))
* add vaut-api package example folder
([0f57071](https://github.com/linagora/tom-server/commit/0f570716d069bf75b7c132216319860e2272c37d)),
closes [#23](https://github.com/linagora/tom-server/issues/23)
* vault-api main class
([873fdfe](https://github.com/linagora/tom-server/commit/873fdfea96795e184f175fabb8e11854279c13d2))
* vault-api auth and parser middlewares
([8f849cf](https://github.com/linagora/tom-server/commit/8f849cfc95c15648fc9904c302fdd50be47691c5))
* vault-api controllers
([dc293d7](https://github.com/linagora/tom-server/commit/dc293d71f4af504724e6180a507c9b2ed39284bc))
* vault-api database manager
([83e4677](https://github.com/linagora/tom-server/commit/83e467763cf86ccf86f865e0fafb60a893879aa1))
* init vault-api package
([5d067d7](https://github.com/linagora/tom-server/commit/5d067d7496ca8542ee0e8396b923b4873f13bdde))

#### Fixes

* add missing run dep
([cf5bba1](https://github.com/linagora/tom-server/commit/cf5bba11be00546a2b4ff086b98d0dc2e418f777))
* avoid update docs when merging on master
([56d165c](https://github.com/linagora/tom-server/commit/56d165cbc2b1322e6c457210e08ec77772502e61))
* rename federated identity service push workflow file
([9a4d8a4](https://github.com/linagora/tom-server/commit/9a4d8a44152d401f99e1b2f79da0f574f44d1110)),
closes [#43](https://github.com/linagora/tom-server/issues/43)
* remove remaining files of older federation server
([305dead](https://github.com/linagora/tom-server/commit/305dead134ecb83f70c018c0833c0bac863282bc))
* test after updating dependencies
([2cd8fcb](https://github.com/linagora/tom-server/commit/2cd8fcb74950f7d08305560eebd330b48e2f0265))
* rename files and folders
([2550d09](https://github.com/linagora/tom-server/commit/2550d093fca2105ab7a87487a99756018400f147)),
closes [#38](https://github.com/linagora/tom-server/issues/38)
* rename "federation" to "federated identity" in source code
([04bddba](https://github.com/linagora/tom-server/commit/04bddbac638ba2d71782a6b2fb7b4a126bb5724e))
* update-docs workflow yaml file
([189f9cc](https://github.com/linagora/tom-server/commit/189f9cc801a172529491c2fa9f9a88963428e8e4))
* execute update-docs before merge
([aa8fad6](https://github.com/linagora/tom-server/commit/aa8fad6af070bf0c125b5bf545bea82d345f9b73))
* set explicit test containers names
([6f8f844](https://github.com/linagora/tom-server/commit/6f8f844c78c64c192c36d6331a6c66d45e0f1d93))
* ports allocation for integration tests
([c8cc882](https://github.com/linagora/tom-server/commit/c8cc8823d0d58662361f14eaa479fba3e2afcddc))
* add reverse-proxy validation for matrix-application-service package
([83570a5](https://github.com/linagora/tom-server/commit/83570a562b22bfb744a02420853a90ee92c2c688))
* matrix-invite tests for node 20.12.2
([ccf8e05](https://github.com/linagora/tom-server/commit/ccf8e05cfd6f23253122e9b4eed090f1261ff9b7))
* express-rate-limiting when tom-server is behind a reverse-proxy
([015cef2](https://github.com/linagora/tom-server/commit/015cef2fcc97159c42e263eaaf77e6b1e0d7baa0))
* matrix-invite tests for node 20.12.2
([6b314c0](https://github.com/linagora/tom-server/commit/6b314c0f7402d6a883e52b4bc92f66e77b328f16))
* remove dependency with parent in tom-server identity-provider
([91d1d0c](https://github.com/linagora/tom-server/commit/91d1d0c4ec762c4b3494b0167db1559868bb2976))
* polynomial regular expression errors
([2bc5f35](https://github.com/linagora/tom-server/commit/2bc5f35ec5bc777fa77ad647dedbf1902a43b266))
* remove codeql.yml
([b584809](https://github.com/linagora/tom-server/commit/b58480956a3303854492aa7843f88b8790ff33b0))
* ignore docs and tests files for codeql and devskim scanning
([1d89b80](https://github.com/linagora/tom-server/commit/1d89b80c69d444da1511926dc4e190cbb860bbbf))
* ignore tests files and documentation on code scanning
([ae7c8a8](https://github.com/linagora/tom-server/commit/ae7c8a822bb52417ea82fdbe11305d5f420748b1)),
closes [#16](https://github.com/linagora/tom-server/issues/16)
* use additional_features to activate company features
([f219665](https://github.com/linagora/tom-server/commit/f219665fdd92f17b5986a77cc88a47f1d2f3a937))
* close userDB connection on clean
([cc399a2](https://github.com/linagora/tom-server/commit/cc399a2d142568651aacab0233b2b8598c2c895c))
* logger error for ldap client
([92afc21](https://github.com/linagora/tom-server/commit/92afc219356150889aa85651fbf944a08d3d8515))
* set db client only if has not be done already
([29d5d2c](https://github.com/linagora/tom-server/commit/29d5d2ccdc74b5d1078f0722c14f11474c33e979))
* run update doc job with PR events
([e77cce3](https://github.com/linagora/tom-server/commit/e77cce3229ae1201b6e547b463698cb9a2fcb840))
* ci job update docs
([1809d50](https://github.com/linagora/tom-server/commit/1809d502702ff49f134a141089152dca68e7898f))
* run tests without build packages
([63cfc30](https://github.com/linagora/tom-server/commit/63cfc302fa078b82f29d1bff02de8edb3bdf8336))
* remove --skip-nx-cache in package.json
([b0999e6](https://github.com/linagora/tom-server/commit/b0999e60a392535a3d8b80db31a4741c968af666))
* add limit and offset for /_twake/identity/v1/lookup/diff endpoint
([7281867](https://github.com/linagora/tom-server/commit/728186797f599d546c04a4f0ecf2c326bf93c063))
* missing force option for npm cache clean
([488aeb3](https://github.com/linagora/tom-server/commit/488aeb3f9ea727f17f3372c7991a56bff72d7380))
* date in logger tests
([2c18341](https://github.com/linagora/tom-server/commit/2c183419ed959f0e15aa0933cfbdb8fcaadc0e2e))
* reduce db queries for fed server lookups endpoint
([b088094](https://github.com/linagora/tom-server/commit/b088094d5db76b12918a1b3c82083fbee11733b9))
* imports format and remove useless files
([f5be90e](https://github.com/linagora/tom-server/commit/f5be90e323005e3b5fe22343fa4435f802ba17b5))
* logger max listeners exception and fix tests
([cacb918](https://github.com/linagora/tom-server/commit/cacb9181032820c665b0caad3a55276e9e7c56d1))
* move dev dependencies to main package.json file
([2279849](https://github.com/linagora/tom-server/commit/2279849741da639b44cadb7dfdf0e91698974903))
* federation server lookup endpoint returns hashes array instead of
actives/inactives objects array
([89c44a5](https://github.com/linagora/tom-server/commit/89c44a50ddf29c2b5c1c407835968e22f6eb5505))
* federation auth log message
([bf55b7b](https://github.com/linagora/tom-server/commit/bf55b7be59e22b4e60c28e35460a5c6764aefff5))
* logger display additionnal details
([138fd43](https://github.com/linagora/tom-server/commit/138fd43db20979b84676bc5318802c72708117cc))
* logger clean on stopping tom-server
([414f6c9](https://github.com/linagora/tom-server/commit/414f6c9985be9436fcc38cec3e04c26f02fc38ad))
* tests due to version 1.4.0 of jwilder/nginx-proxy which only works with port
443
([e32c33a](https://github.com/linagora/tom-server/commit/e32c33ad4d59dfb3169501af16e8bea157af9ecf))
* other packages tests
([f46970c](https://github.com/linagora/tom-server/commit/f46970c4c215fe7623035b4c77e2a24c59bb3776))
* federation server logger
([c1fa9f2](https://github.com/linagora/tom-server/commit/c1fa9f2594bba7900fc9c2ffc88002574bd392b3))
* logger module tests
([b3eafd5](https://github.com/linagora/tom-server/commit/b3eafd5362a5b654048b4bdde13503ae0ddecc03))
* regex federation server trusted servers addresses
([82218c9](https://github.com/linagora/tom-server/commit/82218c95a2108f3793a59a5892d5098aa4fb831e))
* federation servers integration tests
([a2e4bc5](https://github.com/linagora/tom-server/commit/a2e4bc5b5f7e8d9bb7e6756f25dfe24efc62bfe8))
* tom-server should work with several federation servers
([6e8828b](https://github.com/linagora/tom-server/commit/6e8828b5d9aa304f8282ab02bb1764928ed3f8f6))
* circular dependency
([72c5390](https://github.com/linagora/tom-server/commit/72c539041b029c6ab2b3b14875016904a184df74))
* add error code for invalid parameter error
([d4f1282](https://github.com/linagora/tom-server/commit/d4f1282bc5c97f485e0c42cafc7af9e9e163093c))
* all tests
([c09ef70](https://github.com/linagora/tom-server/commit/c09ef706c64b479ac6269353b790014daaf79bf2))
* replace pgClient by pgPool
([23aa22e](https://github.com/linagora/tom-server/commit/23aa22e9465c86c74e5acd20714cce7c1a12c36f)),
closes [#80](https://github.com/linagora/tom-server/issues/80)
* set console as default logger output
([fc0a2a7](https://github.com/linagora/tom-server/commit/fc0a2a783a8f1b3e65b03cc9325e9d4050fbb95b))
* handle docker compose v1 and v2 for integration tests
([fe5368e](https://github.com/linagora/tom-server/commit/fe5368ee62f66d5cc226201fbf9be166d806d6b9))
* tom-server application-server integration tests
([2caec32](https://github.com/linagora/tom-server/commit/2caec323b70210f5296ec057f0ebd8cfda836e5f))
* avoid conflict with ports number when tests run in parallel
([5fe79d3](https://github.com/linagora/tom-server/commit/5fe79d32cba839a95853f5e3c5231542e696c177))
* config with conf file not overidden by empty env variables
([8cdd0af](https://github.com/linagora/tom-server/commit/8cdd0afd2925ad260a1f052f345acfdd3eb98348))
* circular dependency in matrix-identity-server cron tasks
([1c6bba3](https://github.com/linagora/tom-server/commit/1c6bba3568080842fef83523421bc033dc98940c))
* pipeline packages/matrix-invite test
([bf84ce9](https://github.com/linagora/tom-server/commit/bf84ce99f7880958323485a6391e922daab3128c))
* matrix-identity-server build
([fb22c1d](https://github.com/linagora/tom-server/commit/fb22c1d5039a17be9577de65413ac23afd3fe3d8))
* matrix-identity-server register endpoint response body
([97449ed](https://github.com/linagora/tom-server/commit/97449ed8756834874ce227f445d18e019f7d36c5))
* additional_features as environment variable
([dd3da31](https://github.com/linagora/tom-server/commit/dd3da31c8f281a7a2e7fd4818e54976f53cc241f))
* clear pending asynchronous processes in tests
([bd5b7b0](https://github.com/linagora/tom-server/commit/bd5b7b04139328c30b06d6d6aa21d5b4528f585d))
* same logger for all matrix-identity-server tests
([574be08](https://github.com/linagora/tom-server/commit/574be08492179a5ea7058c0b08750d806a0abdd8))
* create tables promises resolution
([472db74](https://github.com/linagora/tom-server/commit/472db740ae51c3ee77f79d7a281c660c4df4e84c))
* use capital letter for class
([f9f7e72](https://github.com/linagora/tom-server/commit/f9f7e72a4128e3ba4eee82a1beb19fefcdb08ac2))
* docker environment variable default value
([3c31204](https://github.com/linagora/tom-server/commit/3c3120460c84f53a406d8714c314bc4c1d466b91))
* automatic channel filter works with array value
([9e8dcf6](https://github.com/linagora/tom-server/commit/9e8dcf6b42f5b92d27e58b0c945425f0349d7e59))
* tests in matrix-application-server package
([9597206](https://github.com/linagora/tom-server/commit/9597206a6df95ba9f182bfb7e669161334b840ae))
* issues in matrix application server
([3192029](https://github.com/linagora/tom-server/commit/3192029d0c4bf028f3e382d433226e1b747838f4))
* condition with multiple criteria in database request filter
([6d8c390](https://github.com/linagora/tom-server/commit/6d8c390925fe524f7450efce540d3eb9f8de07ff))
* vulnerabilities on npm install
([30be0e3](https://github.com/linagora/tom-server/commit/30be0e34da49ad8d5214084fa241e3a00f9828b7))
* exitOnError cannot be true if exceptionHandlers is empty
([bec4ab0](https://github.com/linagora/tom-server/commit/bec4ab0fbc101870b0868617977f72ae003f7d07))
* tom-server tests
([382b5fd](https://github.com/linagora/tom-server/commit/382b5fdf8d6003d8f0bbf692d19fe2067bdf89ae))
* rollup external libraries
([ee54c2a](https://github.com/linagora/tom-server/commit/ee54c2af8f8916148c1d1f63c3436657ad18d347))
* packages/tom-server tests
([8bf9274](https://github.com/linagora/tom-server/commit/8bf9274198afff52d9b9e945d3051323eeba567a))
* tests matrix-identity-server
([5384e98](https://github.com/linagora/tom-server/commit/5384e9896a72a437fd57d72d76aaf64d2d398629))
* logger tests
([2669af7](https://github.com/linagora/tom-server/commit/2669af700bd7e44cfe34f53df6268763f9b2a47e))
* test timeout value
([a0347dc](https://github.com/linagora/tom-server/commit/a0347dc5d6a97418c2d0c71bbeaf3c7cfa62e541))
* gitlab-ci
([7a97f5a](https://github.com/linagora/tom-server/commit/7a97f5ace2eaa2c0fd79ac23390d2644e656d9a7))
* get error on ldap connection error
([1adace7](https://github.com/linagora/tom-server/commit/1adace7836036d7244e8ec3131fe271e4f21b30b))
* tests on ci
([222b773](https://github.com/linagora/tom-server/commit/222b773317075dfee2ce09c3a4e76e90401923e5))
* @twake/server tests
([0662283](https://github.com/linagora/tom-server/commit/0662283a4cef952cc6d957ae348bd1824b8f2500))
* sender_localpart is required in config
([6db8a38](https://github.com/linagora/tom-server/commit/6db8a38b6cbffe50e34936b1a80a74aa96403678))
* application service routes and tests
([e1913d3](https://github.com/linagora/tom-server/commit/e1913d31f504f5d0895d47b55e9f38bcfbe9c001))
* application service sends an empty object
([d03272f](https://github.com/linagora/tom-server/commit/d03272f8629c17c5ed10a19f1a4fedcd4226babe))
* authentication token as empty string was considered valid
([3438ded](https://github.com/linagora/tom-server/commit/3438ded3b9c59cd7d17cbd837402aef7841bbb49))
* move routes to specific file
([6e52a07](https://github.com/linagora/tom-server/commit/6e52a07e99723ac97f1f4d8ee1f8b2559b0374e2))
* tests
([ee3679e](https://github.com/linagora/tom-server/commit/ee3679ef4daa6526a27f0ae115f2c9095928fd90))
* keep base_url propery name for server url
([d846ff5](https://github.com/linagora/tom-server/commit/d846ff5b59bb432a777e4bc587340a272d395a40))
* playwright test
([21dd842](https://github.com/linagora/tom-server/commit/21dd8422b730d52ae7b39d6a309f496c2d3af0a5))
* pipeline docker push job
([a910cc0](https://github.com/linagora/tom-server/commit/a910cc07b7f9c2a420766966a7f2c1e00c723be2))
* test matrix-invite
([74a62f4](https://github.com/linagora/tom-server/commit/74a62f44549419de9dde1d01fdc0ec5fc070b530)),
closes [#35](https://github.com/linagora/tom-server/issues/35)
* readonly database message in tests and asynchronous issues
([f92a465](https://github.com/linagora/tom-server/commit/f92a465e1e1ef4b65e885be62688d5482d0dec37))
* cleaner way to handle path in test files
([2407ade](https://github.com/linagora/tom-server/commit/2407ade554060400c75c83eb960cbd2ffd9a6ca0))
* update endpoint path
([603549c](https://github.com/linagora/tom-server/commit/603549c2de4cd5934cf1c9af975516b9bcdea126))
* handle response error with a global middleware
([0ad4e67](https://github.com/linagora/tom-server/commit/0ad4e674c8749393f37dbbaa0d80f1a070fbd24d))
* matrix-identity-server build
([3799b75](https://github.com/linagora/tom-server/commit/3799b752fe969fb7fe2fe848a327a71ff4354a80))
* format in project
([6adcedd](https://github.com/linagora/tom-server/commit/6adcedd0dc8b6b2bd1e3b12814c186bd433d91b5))
* use npm ci command instead of npm install
([09389e3](https://github.com/linagora/tom-server/commit/09389e3dcffb4ffd009606691ae496ba121032eb))
* update cache policy depending on stage
([a905c65](https://github.com/linagora/tom-server/commit/a905c65a7de9a6426b0ce258530fb3853c745a39))
* use gitlab-runner-002.linagora.dc2 for ci
([a0fd82e](https://github.com/linagora/tom-server/commit/a0fd82e04c49111778891ffbe7db9c2dd1a5c8be))
* ci missing build and dist folders in artifacts
([3d918d6](https://github.com/linagora/tom-server/commit/3d918d679bbb26cbb9077e839331e2259cc2f890))

<!-- markdownlint-disable-file MD024 -->

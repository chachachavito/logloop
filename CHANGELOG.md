# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [0.7.1](https://github.com/chachachavito/logloop/compare/v0.7.0...v0.7.1) (2026-04-30)


### Features

* **core:** implement dual-write strategy with lowdb integration ([67402fe](https://github.com/chachachavito/logloop/commit/67402fe9fb5b078d1110a285fa832d4278b10eb5))

## [0.7.0](https://github.com/chachachavito/logloop/compare/v0.6.0...v0.7.0) (2026-04-30)

### Refactoring
* **storage:** switch primary read operations to `lowdb` (list, timeline, summary).
* **core:** implement **dual-write** strategy (JSON + Markdown) to ensure data durability and human-readability.
* **esm:** full project conversion to ES Modules for native dependency support.

## [0.6.0](https://github.com/chachachavito/logloop/compare/v0.5.0...v0.6.0) (2026-04-30)

### Features
* **db:** integrate `lowdb` for structured log storage and metadata.
* **migration:** automatic incremental migration from legacy markdown files to JSON store.
* **logs:** add global log retrieval and enhance dashboard functionality ([b2610cd](https://github.com/chachachavito/logloop/commit/b2610cd1cca79248f2c8ab5d06b91e5072c19a65))
* **logs:** add global log retrieval functionality ([b2194fa](https://github.com/chachachavito/logloop/commit/b2194fa9e5aeb1afbac850263208f578af538887))

## [0.5.0](https://github.com/chachachavito/logloop/compare/v0.3.7...v0.5.0) (2026-04-29)

### [0.3.7](https://github.com/chachachavito/logloop/compare/v0.3.6...v0.3.7) (2026-04-29)


### Documentation

* **contributing:** add contributing guidelines and development commands ([4bfa1f6](https://github.com/chachachavito/logloop/commit/4bfa1f6fb0cafaac722aaaafc4db54903e942012))

### [0.3.6](https://github.com/chachachavito/logloop/compare/v0.3.5...v0.3.6) (2026-04-29)


### Documentation

* **readme:** enhance installation instructions and add FAQ section ([2e2fb99](https://github.com/chachachavito/logloop/commit/2e2fb99dff4add9ca2b8f084e8575e1d77bd7d71))

### [0.3.5](https://github.com/chachachavito/logloop/compare/v0.3.4...v0.3.5) (2026-04-29)


### Features

* **ui:** enhance user interaction and update links ([1205d64](https://github.com/chachachavito/logloop/commit/1205d64ef25bbe4b9694bf8e9a2334efc5fefdd3))

### [0.3.4](https://github.com/chachachavito/logloop/compare/v0.3.3...v0.3.4) (2026-04-29)


### Documentation

* **architecture:** update architecture documentation and enhance README clarity ([7ad29e0](https://github.com/chachachavito/logloop/commit/7ad29e02cb4c41cda2582d6ae740e159a45ecea0))
* **readme:** update documentation for clarity and consistency ([9da2af3](https://github.com/chachachavito/logloop/commit/9da2af38832561841a961adc5ddd4b46929be6f2))

### [0.3.3](https://github.com/chachachavito/logloop/compare/v0.3.2...v0.3.3) (2026-04-29)


### Features

* **core:** enhance mood tracking and logging output ([9302913](https://github.com/chachachavito/logloop/commit/930291385b791b6492052065bb21b1f59601498c))

### [0.3.2](https://github.com/chachachavito/logloop/compare/v0.3.1...v0.3.2) (2026-04-29)

### [0.3.1](https://github.com/chachachavito/logloop/compare/v0.3.0...v0.3.1) (2026-04-29)


### Features

* **ui:** update version to 0.3.0 and enhance mood tracking ([7ea3ec7](https://github.com/chachachavito/logloop/commit/7ea3ec72b42b727ebadae179fa71d606716df0a4))

## [0.3.0](https://github.com/chachachavito/logloop/compare/v0.4.3...v0.3.0) (2026-04-29)


### Features

* **global:** support subcommands (list, timeline, summary, search, filter) ([23504a3](https://github.com/chachachavito/logloop/commit/23504a3804ed54a27bd320b6dc0514c689daa03b))
* **storage:** add configurable storage strategy (repo | local | mirror) ([03bd1f3](https://github.com/chachachavito/logloop/commit/03bd1f30027fd399fcaf98c99d0d642571c06ee7))


### Documentation

* **readme:** update version to v0.4.3 for clarity ([1c1ae23](https://github.com/chachachavito/logloop/commit/1c1ae23209a507e88702f84ca03c0ab40d51c9d6))

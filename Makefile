PACKAGES := \
	wordpress

BUNDLES := $(PACKAGES)

PACKAGES_DIR := packages
DIST_DIRS := $(wildcard packages/*/dist)

BABEL := $(realpath node_modules/.bin/babel)
ROLLUP := $(realpath node_modules/.bin/rollup)
LERNA := $(realpath node_modules/.bin/lerna)
TSC := $(realpath node_modules/.bin/tsc)
JEST := $(realpath node_modules/.bin/jest)
ESLINT := $(realpath node_modules/.bin/eslint)
POSTCSS := $(realpath node_modules/.bin/postcss)

BABEL_CONFIG := $(realpath .babelrc)
ROLLUP_CONFIG := $(realpath rollup.config.js)

TSC_FLAGS :=
BABEL_FLAGS := --config-file $(BABEL_CONFIG) --extensions .js --source-maps
ROLLUP_FLAGS := --config $(ROLLUP_CONFIG)
JEST_FLAGS := --ci --passWithNoTests
ESLINT_FLAGS := --config .eslintrc.js "packages/*/src/**/*.ts"

BUILD_TARGETS := $(addprefix build-,$(PACKAGES))
BUNDLE_TARGETS := $(addprefix bundle-,$(BUNDLES))
UNIT_TEST_TARGETS := $(addprefix unit-test-,$(PACKAGES))


# ------------------------------------------------------------------------------
#
# Convenience Targets
# ===================
#
# These are convenience targets to make life easier and make calls pretty :)
#
# ------------------------------------------------------------------------------

.PHONY: default
default: bootstrap
	$(MAKE) all

.PHONY: all
all:
	$(MAKE) build
	$(MAKE) bundle

# ------------------------------------------------------------------------------
#
# Bootstrap
# =========
#
# The bootstrap target is responsible for setting up the monorepo and
# installing necessary dependencies.
#
# ------------------------------------------------------------------------------

.PHONY: bootstrap
bootstrap:
	yarn

# ------------------------------------------------------------------------------
#
# Unit Tests
# ==========
#
# These targets are for running unit tests in each package. Unit tests are run
# by Jest in Node.JS and require no external services (like a browser or
# LambdaTest). They're the simplest and fastest tests.
#
# ------------------------------------------------------------------------------

.PHONY: unit-test
unit-test:
	@$(JEST) $(JEST_FLAGS)

.PHONY: $(UNIT_TEST_TARGETS)
$(UNIT_TEST_TARGETS):
	cd $(PACKAGES_DIR)/$(subst unit-test-,,$@) && \
	$(JEST) $(JEST_FLAGS) --config ./jest.config.js

# ------------------------------------------------------------------------------
#
# Build
# =====
#
# These targets build each package by first compiling the package with
# TypeScript, then sending the resulting ES Next JavaScript through Babel to
# produce suitable outputs for each target environment.
#
# ------------------------------------------------------------------------------

.PHONY: build
build: $(STYLE_TARGETS) $(BUILD_TARGETS)

.PHONY: $(BUILD_TARGETS)
$(BUILD_TARGETS):
	cd $(PACKAGES_DIR)/$(subst build-,,$@) && \
	$(TSC) $(TSC_FLAGS) && \
	BABEL_ENV=browser $(BABEL) dist/esnext -d dist/esm $(BABEL_FLAGS) && \
	BABEL_ENV=node $(BABEL) dist/esnext -d dist/cjs $(BABEL_FLAGS)

# ------------------------------------------------------------------------------
#
# Bundle
# ======
#
# These targets bundle each package into artifacts for use in the browser using
# Rollup. Each package has a `development` and `production` build.
#
# ------------------------------------------------------------------------------

.PHONY: bundle
bundle: $(BUNDLE_TARGETS)

.PHONY: $(BUNDLE_TARGETS)
$(BUNDLE_TARGETS):
	cd $(PACKAGES_DIR)/$(subst bundle-,,$@) && \
	NODE_ENV=development $(ROLLUP) $(ROLLUP_FLAGS) && \
	NODE_ENV=production $(ROLLUP) $(ROLLUP_FLAGS)

# ------------------------------------------------------------------------------
#
# Publish
# =======
#
# Publishes all package versions that aren't currently in the package registry.
# This command cleans all packages, then builds and bundles all packages.
#
# ref: https://github.com/lerna/lerna/tree/master/commands/publish#bump-from-package
#
# ------------------------------------------------------------------------------

.PHONY: publish
publish:
	$(MAKE) clean
	$(MAKE) build
	$(MAKE) bundle
	$(LERNA) publish from-package --yes

# ------------------------------------------------------------------------------
#
# Clean
# =====
#
# These targets are for cleaning the repository and throwing out built
# artifacts.
#
# ------------------------------------------------------------------------------

.PHONY: clean
clean:
	rm -rf $(DIST_DIRS)

# ------------------------------------------------------------------------------
#
# Lint
# ====
#
# These targets lint the source files using ESLint.
#
# ------------------------------------------------------------------------------

.PHONY: lint
lint:
	$(ESLINT) $(ESLINT_FLAGS)

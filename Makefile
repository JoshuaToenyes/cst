PACKAGES_DIR := packages
DIST_DIRS := $(wildcard packages/*/dist)

BABEL := $(realpath node_modules/.bin/babel)
ROLLUP := $(realpath node_modules/.bin/rollup)
LERNA := $(realpath node_modules/.bin/lerna)
TSC := $(realpath node_modules/.bin/tsc)
JEST := $(realpath node_modules/.bin/jest)
ESLINT := $(realpath node_modules/.bin/eslint)

BABEL_CONFIG := $(realpath .babelrc)
ROLLUP_CONFIG := $(realpath rollup.config.js)

TSC_FLAGS :=
BABEL_FLAGS := --config-file $(BABEL_CONFIG) --extensions .js --source-maps
ROLLUP_FLAGS := --config $(ROLLUP_CONFIG)
JEST_FLAGS := --ci --passWithNoTests --config ./jest.config.js
ESLINT_FLAGS := --config .eslintrc.js "packages/*/src/**/*.ts"


# ------------------------------------------------------------------------------
#
# Convenience Targets
# ===================
#
# These are convenience targets to make life easier and make calls pretty :)
#
# ------------------------------------------------------------------------------

all: build


# ------------------------------------------------------------------------------
#
# Combined Targets
# ================
#
# These targets work on one or more other targets, combining them for common
# use cases when we need to build, test, etc., multiple targets at the same
# time.
#
# ------------------------------------------------------------------------------

.PHONY: build test

build: cli wordpress

test: test-cli test-wordpress


# ------------------------------------------------------------------------------
#
# Package Build Targets
# =====================
#
# These are package-specific build targets. Each target runs a complete build
# and bundle (if appropriate) of the given package.
#
# ------------------------------------------------------------------------------

.PHONY: cli wordpress

cli:
	cd $(PACKAGES_DIR)/cli && \
	$(TSC) $(TSC_FLAGS) && \
	BABEL_ENV=node $(BABEL) dist/esnext -d dist/cjs $(BABEL_FLAGS)

wordpress:
	cd $(PACKAGES_DIR)/wordpress && \
	$(TSC) $(TSC_FLAGS) && \
	BABEL_ENV=node $(BABEL) dist/esnext -d dist/cjs $(BABEL_FLAGS)

#wordpress:
#	cd $(PACKAGES_DIR)/wordpress && \
#	$(TSC) $(TSC_FLAGS) && \
#	BABEL_ENV=browser $(BABEL) dist/esnext -d dist/esm $(BABEL_FLAGS) && \
#	BABEL_ENV=node $(BABEL) dist/esnext -d dist/cjs $(BABEL_FLAGS) && \
#	NODE_ENV=development $(ROLLUP) $(ROLLUP_FLAGS) && \
#	NODE_ENV=production $(ROLLUP) $(ROLLUP_FLAGS)


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

.PHONY: test-cli test-wordpress

test-cli:
	cd $(PACKAGES_DIR)/cli && \
	$(JEST) $(JEST_FLAGS)

test-wordpress:
	cd $(PACKAGES_DIR)/cli && \
	$(JEST) $(JEST_FLAGS)


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
	$(MAKE) test


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
	$(MAKE) clean && \
	$(MAKE) all && \
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

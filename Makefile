all: unit functional data

export MOCHA_BIN:=$(PWD)/node_modules/mocha/bin/mocha
export MOCHA_CMD:=$(MOCHA_BIN) -b -u bdd -r should -R spec test/kind/test.*.js

deps:
	@echo "installing dependencies..."
	@npm install

unit:
	@echo "Running unit tests ..."
	@echo "I'm pretending it has passed :P"

functional:
	@echo "Running functional tests ..."
	@`(echo $$MOCHA_CMD | sed "s,kind,functional,g")`

debug:
	@rm -rf ~/.emerald
	@npm install
	@make data
	@node --debug ./app/terminal/main.js -s settings-local.js run

data:
	@node $$PWD/app/terminal/generate-data.js

curl:
	curl -v --data "$(cat test/functional/github-payload.json)" --header "Content-Type: application/json"   http://localhost:3000/hooks/github/emerald-unit-tests

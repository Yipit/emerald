all: unit functional data

export MOCHA_BIN:=$(PWD)/node_modules/mocha/bin/mocha
export MOCHA_CMD:=$(MOCHA_BIN) -b -u bdd -r should -R spec test/kind/test.*.js

init:
	@echo "installing mocha (if necessary)..."
	@test -e $$MOCHA_BIN || npm install -g mocha
	@echo "installing other dependencies..."
	@npm install

unit:
	@echo "Running unit tests ..."
	@echo "I'm pretending it has passed :P"

functional: init clean
	@echo "Running functional tests ..."
	@`(echo $$MOCHA_CMD | sed "s,kind,functional,g")`

clean:
	@printf "Cleaning up files that are already in .gitignore... "
	@for pattern in `cat .gitignore`; do find . -name "$$pattern" -delete; done
	@echo "OK!"

debug:
	@rm -rf ~/.emerald
	@npm install
	@make data
	@node --debug ./app/terminal/main.js -s settings-local.js run

data:
	@node $$PWD/app/terminal/generate-data.js

curl:
	curl -v --data "$(cat test/functional/github-payload.json)" --header "Content-Type: application/json"   http://localhost:3000/hooks/github/emerald-unit-tests

all: unit functional data

export VOWS_BIN:=$(PWD)/node_modules/vows/bin/vows
export VOWS_CMD:=$(VOWS_BIN) --spec spec/kind/*.js

init:
	@echo "installing vows (if necessary)..."
	@test -e `which vows` || test -e $$VOWS_BIN || npm install -g vows
	@echo "installing other dependencies..."
	@npm install

unit: init clean
	@echo "Running unit tests ..."
	@`(echo $$VOWS_CMD | sed "s,kind,unit,g")`

functional: init clean
	@echo "Running functional tests ..."
	@`(echo $$VOWS_CMD | sed "s,kind,functional,g")`

clean:
	@printf "Cleaning up files that are already in .gitignore... "
	@for pattern in `cat .gitignore`; do find . -name "$$pattern" -delete; done
	@echo "OK!"

data:
	@node $$PWD/app/cli/generate-data.js

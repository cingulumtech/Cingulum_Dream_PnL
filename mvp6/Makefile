.PHONY: build deploy rollback

build:
	./scripts/build_frontend.sh

deploy: build
	./scripts/deploy_gapserver.sh

rollback:
	./scripts/rollback_gapserver.sh

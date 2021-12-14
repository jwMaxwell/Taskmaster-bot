update:
	git checkout .
	git checkout main
	git pull
	npm ci

clean:
	git reset --hard
	git clean -fdx -e ".env" -e ".env.testing" -e "*.log" -e "*-audit.json"
	git checkout main
	git pull
	npm ci

cleanLogs:
	rm src/combined*log
	rm src/combined-audit.json
	rm src/error*log
	rm src/error-audit.json
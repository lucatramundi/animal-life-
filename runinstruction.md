1. cd C:/SWLAB/animal-life-.worktrees/check-existing-agents-offline-feature
2. npx swa start . --api-location ./api --api-port 7072
3. # From a git bash terminal
4. cd C:/SWLAB/animal-life-.worktrees/check-existing-agents-offline-feature
5. azurite --location .azurite --debug .azurite\debug.log
6. # Run azure function from the api/src folder
7. cd C:/SWLAB/animal-life-.worktrees/check-existing-agents-offline-feature/api/src
8. func start --port 7072

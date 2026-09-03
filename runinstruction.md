
## Clean restart 
Set-Location 'C:\SWLAB\animal-life-\api\src'

func start --port 7072

Set-Location 'C:\SWLAB\animal-life-'

npx swa start . --api-location ./api --api-port 7072

Set-Location 'C:\SWLAB\animal-life-'
azurite --location .azurite --debug .azurite\debug.log

Doc

	https://medium.com/@ilovepixelart/streamline-your-changes-with-ts-migrate-mongoose-a-practical-migration-framework-for-mongoose-cc396a5f8640

To create a new migration file:

	from project ROOT directory (not from /migrations/ directory):
	
	npx migrate create first-migration-demo -d MONGODBURI


Migration naming convention:

	For country specific migrations:

		XX-description

		Where XX is the ID of the country in case 
	
	For migrations that concerns all instances:
	
		description
		
		
To start manually a migration

	npx migrate up <migration_name>
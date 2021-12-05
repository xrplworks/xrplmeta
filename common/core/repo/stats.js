export function init(){
	this.exec(
		`CREATE TABLE IF NOT EXISTS "Stats" (
			"id"		INTEGER NOT NULL UNIQUE,
			"trustline"	INTEGER NOT NULL,
			"ledger"	INTEGER NOT NULL,
			"count"		INTEGER NOT NULL,
			"supply"	TEXT NOT NULL,
			"bid"		TEXT NOT NULL,
			"ask"		TEXT NOT NULL,
			PRIMARY KEY ("id" AUTOINCREMENT),
			UNIQUE ("ledger", "trustline")
		);

		CREATE INDEX IF NOT EXISTS 
		"StatsTrustline" ON "Stats" 
		("trustline");`
	)
}


export function insert({ledger, trustline, replaceAfter, ...stats}){
	let trustlineId = this.trustlines.id(trustline)

	if(replaceAfter){
		this.run(
			`DELETE FROM Stats
			WHERE trustline = ?
			AND ledger > ?`,
			trustlineId,
			replaceAfter
		)
	}

	return this.insert({
		table: 'Stats',
		data: {
			ledger,
			trustline: trustlineId,
			...stats
		},
		duplicate: 'update'
	})
}


export function all(trustline){
	let trustlineId = this.trustlines.id(trustline)

	return this.all(
		`SELECT Stats.id, trustline, "count", supply, bid, ask, date
		FROM Stats
		INNER JOIN Ledgers ON ("index" = Stats.ledger)
		WHERE trustline = ?
		ORDER BY ledger ASC`,
		trustlineId
	)
}


export function get(trustline, ledger){
	if(ledger === undefined){
		return this.get(
			`SELECT *
			FROM Stats
			WHERE trustline = ?
			ORDER BY ledger DESC`,
			trustline.id
		)
	}else{
		return this.get(
			`SELECT *
			FROM Stats
			WHERE trustline = ?
			AND ledger >= ?
			ORDER BY ledger ASC`,
			trustline.id,
			ledger
		)
	}
	
}
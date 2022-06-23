import EventEmitter from 'events'
import Socket from '@xrplkit/socket'
import log from '@mwni/log'


export default class Node extends EventEmitter{
	constructor(config){
		super()

		this.name = config.url
			.replace(/^wss?:\/\//, '')
			.replace(/:[0-9]+/, '')

		this.tasks = []
		this.socket = new Socket(config.url)

		this.socket.on('transaction', tx => {
			this.emit('event', {hash: tx.transaction.hash, tx})
		})

		this.socket.on('ledgerClosed', ledger => {
			this.emit('event', {hash: ledger.ledger_hash, ledger})

			/*if(ledger.validated_ledgers){
				spec.ledgers = ledger.validated_ledgers
					.split(',')
					.map(range => range
						.split('-')
						.map(i => parseInt(i))
					)
			}*/
		})

		this.socket.on('connected', async () => {
			try{
				await this.socket.request({
					command: 'subscribe',
					streams: ['ledger', 'transactions']
				})
			}catch(error){
				log.warn(`failed to subscribe to node "${this.name}":`)
				log.warn(error)
			}
		})

		this.socket.on('disconnected', async event => {
			this.error = event.reason 
				? event.reason
				: `code ${event.code}`
		})

		this.socket.on('error', error => {
			this.error = error.reason 
				? error.message
				: `unknown connection failure`
		})
	}

	get connected(){
		return this.socket.connected
	}

	bid(payload){
		if(this.busy)
			return 0

		if(payload.command){
			if(payload.ticket){
				if(this.tasks.some(task => task.ticket === payload.ticket))
					return Infinity
				else
					return 0
			}

			return 1
		}else if(payload.type === 'reserveTicket'){
			if(payload.node){
				if(payload.node !== this.name)
					return 0
			}

			return 1
		}
	}

	async do(payload){
		if(payload.command){
			this.busy = true
			
			let result = await this.socket.request(payload)

			this.busy = false

			return result
		}else if(payload.type === 'reserveTicket'){
			let ticket = Math.random()
				.toString(16)
				.toUpperCase()
				.slice(2, 10)

			this.tasks.push({
				type: payload.task,
				ticket,
				node: this.name
			})

			return {ticket}
		}
	}
}
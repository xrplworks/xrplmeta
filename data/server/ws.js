import { log } from '../lib/log.js'
import * as procedures from './procedures.js'


export default class{
	constructor(ctx){
		this.ctx = ctx
		this.clients = []
		this.counter = 0
	}

	register(socket){
		 let client = {
			id: ++this.counter,
			socket, 
			//ip: request.socket.remoteAddress
		}

		socket.on('message', async message => {
			try{
				var request = JSON.parse(message)
			}catch{
				log.info(`client #${client.id} sent malformed request - dropping them`)
				socket.close()
			}

			try{
				let data = await this.serveRequest(client, request.payload)

				socket.send(JSON.stringify({request: request.id, data}))
			}catch(error){
				let response = null

				if(typeof error === 'object'){
					if(error.expose)
						response = error
				}

				if(!response){
					log.info(`internal server error while serving client #${client.id}: ${error}`)
					response = {message: 'internal server error'}
				}

				socket.send(JSON.stringify({request: request.id, error: response}))
			}
		})

		socket.on('close', () => {
			this.clients.splice(this.clients.indexOf(client))
			log.info(`client #${client.id} disconnected`)
		})

		this.clients.push(client)
		log.info(`new connection (#${client.id})`)
	}

	async serveRequest(client, request){
		if(!procedures[request.command]){
			throw {message: 'unknown command', expose: true}
		}

		return await procedures[request.command]({
			...this.ctx,
			parameters: request
		})
	}
}
import log from '@mwni/log'
import { wait } from '@xrplkit/time'
import { fetch as fetchLedger } from './ledger.js'



export async function startForward({ ctx, startSequence }){
	let latestLedger = await fetchLedger({ 
		ctx,
		sequence: 'validated' 
	})

	let stream = createStream({
		startSequence,
		targetSequence: latestLedger.sequence
	})

	ctx.xrpl.on('ledger', ledger => {
		stream.targetSequence = ledger.sequence
		stream.ledgers[ledger.sequence] = ledger

		stream.resolveNext()
	})

	createFiller({ ctx, stream, stride: 1 })
	
	return stream
}

function createStream({ startSequence, targetSequence }){
	let currentSequence = startSequence
	let resolveNext = () => 0
	let ledgers = {}

	return {
		get currentSequence(){
			return currentSequence
		},

		get targetSequence(){
			return targetSequence
		},

		set targetSequence(sequence){
			targetSequence = sequence
		},

		get ledgers(){
			return ledgers
		},

		get resolveNext(){
			return resolveNext
		},

		async next(){
			while(!ledgers[currentSequence]){
				await new Promise(resolve => resolveNext = resolve)
			}

			let ledger = ledgers[currentSequence]

			delete ledgers[currentSequence]
			currentSequence += targetSequence >= currentSequence ? 1 : -1

			return ledger
		}
	}
}


function createFiller({ ctx, stream, stride }){
	const concurrency = ctx.xrpl.connectionsCount
	const maxQueueSize = ctx.config.ledger.streamQueueSize

	for(let n=0; n<concurrency; n++){
		(async () => {
			let sequence = stream.currentSequence

			while(true){
				let stepsToTarget = (stream.targetSequence - sequence) * stride
	
				if(stepsToTarget < 0){
					await wait(100)
					continue
				}

				if(Object.keys(stream.ledgers).length > maxQueueSize){
					await wait(1000)
					continue
				}

				if(stream.ledgers.hasOwnProperty(sequence)){
					sequence += stride
					continue
				}

				stream.ledgers[sequence] = undefined

				try{
					stream.ledgers[sequence] = await fetchLedger({ 
						ctx, 
						sequence 
					})

					stream.resolveNext()
						
				}catch(error){
					console.warn(`failed to fetch ledger #${index}:`)
					console.warn(error)
					delete stream.ledgers[sequence]
				}
			}
		})()
	}
}
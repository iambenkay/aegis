'use strict'

import DistributedCache from '../domain/distributed-cache'
import EventBus from '../services/event-bus'
import { MeshService } from '../services'
import { forwardEvents } from './forward-events'
import uuid from '../domain/util/uuid'

const BROADCAST = process.env.TOPIC_BROADCAST || 'broadcastChannel'
const useObjectCache = /true/i.test(process.env.DISTRIBUTED_CACHE_ENABLED)
const useSvcMesh = /true/i.test(process.env.SERVICEMESH_ENABLED) || true


/**
 * Handle internal and external events.
 * @param {import('../domain/observer').Observer} observer
 * @param {import("../domain/datasource-factory")} datasources
 * @param {import("../domain/model-factory").ModelFactory} models
 */
export default function brokerEvents (observer, datasources, models) {
  const svcPub = event => MeshService.publish(event, observer)
  const svcSub = (event, cb) => MeshService.subscribe(event, cb, observer)

  const busPub = event => EventBus.notify(BROADCAST, JSON.stringify(event))
  const busSub = (event, cb) =>
    EventBus.listen({
      topic: BROADCAST,
      id: uuid(),
      once: false,
      filters: [event],
      callback: msg => cb(JSON.parse(msg))
    })

  const publish = useSvcMesh ? svcPub : busPub
  const subscribe = useSvcMesh ? svcSub : busSub

  if (useObjectCache) {
    const broker = DistributedCache({
      observer,
      datasources,
      models,
      publish,
      subscribe
    })

    broker.start()
  }

  forwardEvents({ observer, models, publish, subscribe })

  /**
   * This is the cluster cache sync listener - when data is
   * saved in another process, the master forwards the data to
   * all the other workers, so they can update their cache.
   */
  process.on('message', ({ cmd, id, pid, data, name }) => {
    if (cmd && id && data && process.pid !== pid) {
      if (cmd === 'saveCommand') {
        const ds = datasources.getDataSource(name)
        ds.save(id, data, false)
        return
      }

      if (cmd === 'deleteCommand') {
        const ds = datasources.getDataSource(name)
        ds.delete(id, false)
        return
      }
    }
  })
}

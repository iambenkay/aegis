'use strict'

/**
 * @typedef {Object} ModelParam
 * @property {String} modelName
 * @property {import('../domain').ModelFactory} models
 * @property {import('../datasources/datasource').default} repository
 * @property {import('../domain/event-broker').EventBroker} broker
 * @property {...Function} handlers
 */

/**
 * @callback removeModel
 * @param {string} id
 * @returns {Promise<import("../domain").Model>}
 */

/**
 * @param {ModelParam} param0
 * @returns {removeModel}
 */
export default function removeModelFactory ({
  modelName,
  models,
  repository,
  broker,
  handlers = []
} = {}) {
  const eventType = models.EventTypes.DELETE
  const eventName = models.getEventName(eventType, modelName)
  handlers.forEach(handler => broker.on(eventName, handler))

  return async function removeModel (id) {
    const model = await repository.find(id)

    if (!model) {
      throw new Error('no such id')
    }

    const deleted = models.deleteModel(model)
    const event = await models.createEvent(eventType, modelName, deleted)

    const [obsResult, repoResult] = await Promise.allSettled([
      broker.notify(event.eventName, event),
      repository.delete(id)
    ])

    if (obsResult.status === 'rejected') {
      if (repoResult.status === 'fulfilled') {
        await repository.save(id, model)
      }
      throw new Error('model not deleted', obsResult.reason)
    }

    return model
  }
}

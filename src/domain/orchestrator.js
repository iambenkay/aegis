'use strict'

import async from './util/async-error'
import ModelFactory from '.'
import DataSourceFactory from './datasource-factory'
import EventBrokerSingleton from './event-broker'
import EventEmitter from 'events'

export async function generateWorkflow (options) {
  const { wfName, wfInput, wfTasks } = options

  if (ModelFactory.getModelSpec(wfName)) {
    console.warn(wfName, 'already registered')
    return
  }

  /**
   * General workflow
   * @type {import(".").ModelSpecification}
   */
  const workflow = {
    modelName: wfName,
    endpoint: 'workflows',
    factory: () => dependencies =>
      new Object.freeze({ ...dependencies, ...wfInput }),
    ports: wfTasks
  }

  ModelFactory.registerModel(workflow)
}

export async function runWorkflow ({ wfName }) {
  const model = await ModelFactory.createModel(
    EventBrokerSingleton.getInstance(),
    DataSourceFactory.getDataSource(wfName),
    wfName
  )
  await model.emit(wfName)
  console.info(wfName, 'workflow started')
}

/**
 * Check `portFlow` history and resume any workflow
 * that was running before we shut down.
 *
 * @param {Array<import(".").Model>} list
 */
export async function resumeWorkflow (list) {
  if (list?.length > 0) {
    await Promise.all(
      list.map(async function (model) {
        const history = model.getPortFlow()
        const ports = model.getSpec().ports

        if (history?.length > 0 && !model.compensate) {
          const lastPort = history.length - 1
          const nextPort = ports[history[lastPort]].producesEvent

          if (nextPort && history[lastPort] !== 'workflowComplete') {
            await async(model.emit(nextPort, resumeWorkflow.name))
          }
        }
      })
    ).catch(error => console.error(error))
  }
}

export class WorkflowEmitter extends EventEmitter {}
const wfEvents = new WorkflowEmitter()

wfEvents.on('generateWorkflow', payload => {
  generateWorkflow(payload)
})

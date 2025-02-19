'use strict'

/**
 * @typedef {Object} Model Domain entity/service object - conforms to `ModelSpecification`
 * @property {string} Symbol_id - immutable/private model instance uuid
 * @property {string} Symbol_modelName - immutable/private model name
 * @property {number} Symbol_createTime - immutable/private time of creation
 * @property {number} Symbol_updateTime - immutable/private time of last update
 * @property {function(Model,*,number):Model} Symbol_validate - run validations, see `eventMask`
 * @property {function(Model,*):Model} Symbol_onUpdate - immutable/private update function
 * @property {function(Model)} Symbol_onDelete - immutable/private delete function
 * @property {function(Object, boolean):Promise<Model>} update - {@link Model.update} use this function to update the model -
 * specify changes as properties of an object, specify false to skip validation.
 * @property {function()} toJSON - de/serialization logic
 * @property {function(eventName,function(eventName,Model):void)} addListener listen
 * for domain events
 * @property {function(eventName,Model):Promise<void>} emit emit a domain event
 * @property {function()} [mixinMethod] - when the user
 * specifies a mixin, it is applied to the model on creation - adding methods is
 * a common result.
 * @property {*} [mixinData] - when the user specifies a mixin, it is applied to
 * the model on creation - adding fields is a common result.
 * @property {function(function():Promise<Model>):Promise<Model>} [port] - when a
 * port is configured, the framework generates a method on the model object to invoke it.
 * When data arrives on the port, the port's adapter invokes the callback specified
 * in the port configuration, which is passed as an argument to the port function.
 * The callback returns an updated `Model`, and control is returned to the caller.
 * Optionally, an event is fired to trigger the next port function to run
 * @property {function():Promise<any>} [relation] - when you configure a relation,
 * the framework generates a function that your code calls to run the query
 * @property {function(*):*} [command] - the framework will call any authorized
 * model method or function you specify when passed as a parameter or query in
 * an API call.
 * @property {function():string} getName - model name
 * @property {function():string} getId - model instance id
 * @property {function():import(".").ModelSpecification} getSpec - get ModelSpec
 * @property {function():string[]} getPortFlow - get port history
 * @property {function():import(".").ports} getPorts - get port config
 * @property {function():string} getName - model name
 * @property {function(string):{arg0:string,symbol:Symbol}} getKey
 * @property {function():throws} undo - back out transactions
 */

/**
 * @typedef {import(".").Event} Event
 */

import {
  withTimestamp,
  withSerializers,
  withDeserializers,
  fromTimestamp,
  fromSymbol,
  toSymbol
} from './mixins'
import makePorts from './make-ports'
import makeRelations from './make-relations'
import compensate from './compensate'
import asyncPipe from './util/async-pipe'
import compose from './util/compose'
import pipe from './util/pipe'
import uuid from './util/uuid'

/**
 * @namespace
 */
const Model = (() => {
  // Protect core properties from user mixins
  const ID = Symbol('id')
  const MODELNAME = Symbol('modelName')
  const CREATETIME = Symbol('createTime')
  const UPDATETIME = Symbol('updateTime')
  const ONUPDATE = Symbol('onUpdate')
  const ONDELETE = Symbol('onDelete')
  const VALIDATE = Symbol('validate')
  const PORTFLOW = Symbol('portFlow')

  const keyMap = {
    id: ID,
    modelName: MODELNAME,
    createTime: CREATETIME,
    updateTime: UPDATETIME,
    onUpdate: ONUPDATE,
    onDelete: ONDELETE,
    validate: VALIDATE,
    portFlow: PORTFLOW
  }

  /**
   * bitmask for identifying events
   * @enum {number}
   */
  const eventMask = {
    update: 1, //  0001 Update
    create: 1 << 1, //  0010 Create
    onload: 1 << 2 //  0100 Load
  }

  const defaultOnUpdate = (model, changes) => ({ ...model, ...changes })
  const defaultOnDelete = model => withTimestamp('deleteTime')(model)
  const defaultValidate = (model, changes) => defaultOnUpdate(model, changes)

  // caller can skip vadlidation, which is on by default
  const optionalValidation = (model, changes, option = true) => {
    if (option) return model[VALIDATE](changes, eventMask.update)
    return {
      ...model,
      ...changes
    }
  }

  function queueNotice (model) {
    console.debug(queueNotice.name, 'disabled')
    // setTimeout(
    //   async function () {
    //     const eventName = 'UPDATE' + model.getName().toUpperCase()
    //     await model.emit(eventName, { desc: 'domain update', time: Date.now() })
    //   },
    //   3000,
    //   model
    // )
  }

  /**
   * Add data and functions that support framework services.
   * @param {{
   *  model:Model,
   *  args:*,
   *  spec:import('./index').ModelSpecification
   * }} modelInfo
   */
  function make (modelInfo) {
    const {
      model,
      spec: {
        onUpdate = defaultOnUpdate,
        onDelete = defaultOnDelete,
        validate = defaultValidate,
        ports,
        broker,
        modelName,
        datasource,
        mixins = [],
        dependencies,
        relations = {}
      }
    } = modelInfo

    return {
      // User mixins
      ...compose(...mixins)(model),

      // Generate functions to fetch related models
      ...makeRelations(relations, datasource, broker),

      // Generate port functions to handle domain I/O
      ...makePorts(ports, dependencies, broker),

      // Remember port calls
      [PORTFLOW]: [],

      // model class name
      [MODELNAME]: modelName,

      // model instance uuid
      [ID]: uuid(),

      // Called before update is committed
      [ONUPDATE] (changes) {
        return onUpdate(this, changes)
      },

      // Called before delete is committed
      [ONDELETE] () {
        return onDelete(this)
      },

      /**
       * Run validation logic - called on create, load, updated and delete
       * @param {*} changes - updated values
       * @param {eventMask} event - event type, see {@link eventMask}.
       * @returns {Model} - updated model
       */
      [VALIDATE] (changes, event) {
        return validate(this, changes, event)
      },

      /**
       * Return the `eventMask` key name of the value of `event`.
       * Could potentially return multiple key names. See {@link eventMask}.
       * @param {number} event
       * @returns {string[]} key name/s: create, update, onload, delete
       */
      getEventMaskName (event) {
        if (typeof event !== 'number') return
        const keys = Object.keys(eventMask).filter(k => eventMask[k] & event)
        return keys
      },

      /**
       * Compensate for downstream transaction failures.
       * Back out all previous port transactions
       */
      async undo () {
        return compensate(this)
      },

      /**
       * Listen for domain events.
       *
       * @param {string} eventName - name of event
       * @param {function(Model)} callback - called when event is heard
       * @param {boolean} [multi] - allow multiple listeners for event,
       * defaults to `true`
       */
      addListener (eventName, callback, options) {
        broker.on(eventName, callback, options)
      },

      /**
       * Fire domain events.
       *
       * @param {string} eventName - event identifier, unique string
       * @param {Model|Event} eventData - any, but typically `Model`
       * @param {boolean} [forward] - forward event to service mesh,
       * defaults to `false`
       */
      async emit (eventName, eventData, forward = false) {
        await broker.notify(
          eventName,
          {
            eventName,
            eventData,
            model: this
          },
          forward
        )
      },

      /**
       * Concurrency support: strategy is to merge with
       * last update vs blindly overwriting. Concomitant
       * strategy is to add props dynamically and/or as
       * `Symbol`'s to avoid conflict. If updating same
       * props, last one in wins.
       *
       * @param {*} changes - object containing updated props
       * @param {boolean} validate - run validation by default
       * @param {boolean} overwrite - do not merge with last saved
       * copy - the default behavior is to merge
       */
      async update (changes, validate = true, overwrite = false) {
        const model = optionalValidation(this, changes, validate)
        const saved = await datasource.find(model[ID])

        // preserve the most recent updates
        const [fresh, stale] =
          model.updateTime > saved.updateTime ? [model, saved] : [saved, model]

        // by default merge the incoming model with the last one saved
        const merge = overwrite ? model : { ...stale, ...fresh }

        const final = await datasource.save(model[ID], {
          ...merge,
          [UPDATETIME]: Date.now()
        })

        queueNotice(final)
        return final
      },

      /**
       * Search existing model instances (synchronously).
       * Only searches the cache. Does not search persistent storage.
       *
       * @param {{key1, keyN}} filter - list of required matching key-values
       * @returns {Model[]}
       */
      listSync (filter) {
        return datasource.listSync(filter)
      },

      /**
       * Search existing model instances (asynchronously).
       * Searches cache first, then persistent storage if not found.
       *
       * @param {{key1, keyN}} filter
       * @returns {Model[]}
       */
      async list (filter, cache = false) {
        return datasource.list(filter, cache)
      },

      /**
       * Original request passed in by caller
       * @returns arguments passed by caller
       */
      getArgs () {
        return modelInfo.args ? modelInfo.args : []
      },

      /**
       * Identify events types.
       * @returns {eventMask}
       */
      getEventMask () {
        return eventMask
      },

      /**
       * Returns the `ModelSpecification` for this model.
       *
       * @returns {import(".").ModelSpecification}
       */
      getSpec () {
        return modelInfo.spec
      },

      isCached () {
        return modelInfo.spec.isCached
      },

      /**
       * Returns the `ports` for this model.
       *
       * @returns {import(".").ports}
       */
      getPorts () {
        return modelInfo.spec.ports
      },

      /**
       * Returns the `modelName` of this model instance.
       *
       * @returns
       */
      getName () {
        return this[MODELNAME]
      },

      /**
       * Returns ID of this model instance.
       *
       * @returns {string}
       */
      getId () {
        return this[ID]
      },

      /**
       * Return a list of ports invoked by this model instance, in LIFO order.
       *
       * @returns {string[]} history of ports called by this model instance
       */
      getPortFlow () {
        return this[PORTFLOW]
      },

      /**
       * Get the `Symbol` key value for protected properties.
       *
       * @param {string} key - string representation of Symbol
       * @returns {Symbol}
       */
      getKey (key) {
        return keyMap[key]
      }
    }
  }

  /**
   * Call {@link modelInfo/spec/factory} to generate a model instance.
   * Pass the caller's input as arguments to the function. Then call
   * {@link make} to enrich the model with ports, relations, commands,
   * mixins, etc.
   *
   * @lends Model
   * @class
   * @param {{
   *  args: any[],
   *  spec: import('./index').ModelSpecification
   * }} modelInfo Contains model specification and user input to build a model instance
   */
  const Model = async modelInfo =>
    Promise.resolve(
      // Call factory with data from request payload
      modelInfo.spec.factory(...modelInfo.args)
    ).then(model =>
      make({
        model,
        args: modelInfo.args,
        spec: modelInfo.spec
      })
    )

  const validate = event => model => model[VALIDATE]({}, event)

  // Create model instance
  const makeModel = asyncPipe(
    Model,
    withTimestamp(CREATETIME),
    withSerializers(
      fromSymbol(keyMap),
      fromTimestamp(['createTime', 'updateTime'])
    ),
    withDeserializers(toSymbol(keyMap)),
    validate(eventMask.create),
    Object.freeze
  )

  // Recreate model from deserialized object
  const loadModel = pipe(
    make,
    withSerializers(
      fromSymbol(keyMap),
      fromTimestamp(['createTime', 'updateTime'])
    ),
    withDeserializers(toSymbol(keyMap)),
    validate(eventMask.onload),
    Object.freeze
  )

  return {
    /**
     * Create a new model instance
     * @param {{
     *  spec: import('./index').ModelSpecification
     *  args: any[]
     * }} modelInfo
     * @returns {Promise<Readonly<Model>>}
     */
    create: async modelInfo => makeModel(modelInfo),

    /**
     * Load a saved model
     * @param {Model} savedModel deserialized model
     * @param {import('.').ModelSpecification} spec
     */
    load: modelInfo => loadModel(modelInfo),

    /**
     * Process update request.
     * (Invokes user-provided `onUpdate` and `validate` callback.)
     * @param {Model} model - model instance to update
     * @param {Object} changes - Object containing changes
     * @returns {Model} updated model
     *
     */
    update: function (model, changes) {
      const valid = model[VALIDATE](changes, eventMask.update)
      return {
        ...valid,
        [UPDATETIME]: Date.now()
      }
    },

    /**
     *
     * @param {Model} model
     * @param {*} changes
     */
    validate: (model, changes) => model[VALIDATE](changes, eventMask.update),

    /**
     * Process delete request.
     * (Invokes provided `onDelete` callback.)
     * @param {Model} model
     * @returns {Model}
     */
    delete: model => model[ONDELETE](),

    /**
     * Get model name
     * @param {Model} model
     * @returns {string} model's name
     */
    getName: model => model[MODELNAME],

    /**
     * Get private symbol for `key`
     * @param {string} key
     * @returns {Symbol} unique symbol
     */
    getKey: key => keyMap[key],

    /**
     * Get model ID
     * @param {Model} model
     * @returns {string} model's ID
     */
    getId: model => model[ID]
  }
})()

export default Model

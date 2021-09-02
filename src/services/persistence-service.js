'use strict'

import DataSource from '../domain/datasource-factory'

export const Persistence = {
  async save (model) {
    return DataSource.getDataSource(model.getName()).save(model.getId(), model)
  },

  async find (model) {
    return DataSource.getDataSource(model.getName()).find(model.getId())
  },

  close () {
    DataSource.getFactory().close()
  }
}

import Marionette from 'backbone.marionette'
import RootView from './root_view'

export default Marionette.Application.extend({
  region: '#app',

  onStart () {
    this.showView(new RootView())
  }
})

import Marionette from 'backbone.marionette'
import rootTemplate from '../templates/root_view.jst'
import _ from 'underscore'
import Backbone from 'backbone'
import PerfectScrollbar from 'perfect-scrollbar'
import Sortable from 'sortablejs'
import { Subject, fromEvent, interval, animationFrameScheduler } from 'rxjs'
import { filter, map, takeUntil } from 'rxjs/operators'

const Column = Marionette.View.extend({
  template: _.template('<%= n %>'),
  className: 'column'
})
const ColumnsWrapper = Marionette.CollectionView.extend({
  className: 'columns-wrapper',
  childView: Column,
  initialize () {
    this.columnScroll$ = this.getOption('columnScroll$')
  },
  onAttach () {
    this.sortable = new Sortable(this.el, {
      swapThreshold: 1,
      animation: 150,
      onStart: () => {
        this.dragOver$ = fromEvent(document, 'dragover')
          .subscribe(e => this.columnScroll$.next({ event: 'column:dragover', data: {dragEvent: e} }))
      },
      onEnd: () => {
        this.dragOver$.complete()
        this.columnScroll$.next({ event: 'column:dragover:stop' })
      }
    })
  },
  onDestroy () { this.columnScroll$.complete() }
})

const ScrollMachine = Marionette.MnObject.extend({
  scrollingLeft: false,
  scrollingRight: false,
  initialize () {
    this.el = this.getOption('el')
  },
  setBoundings () {
    let boundingClientRect = this.el.getBoundingClientRect()
    this.right = boundingClientRect.right
    this.left = boundingClientRect.left
    this.listenTo(this, 'stopscroll', () => {
      this.scrollingRight = false
      this.scrollLeft = false
    })
  },
  horizontalScrolling (x) {
    let ratio = x / this.right
    if (ratio >= 0.9 && !this.scrollingRight) {
      this.scrollingRight = true
      interval(0, animationFrameScheduler)
        .pipe(
          takeUntil(fromEvent(this.el, 'ps-x-reach-end')),
          takeUntil(fromEvent(this, 'stopscroll')),
          takeUntil(fromEvent(this, 'stopscroll:right'))
        )
        .subscribe(() => { this.el.scrollLeft += 6 })
    }
    if (ratio <= 0.1 && !this.scrollingLeft) {
      this.scrollingLeft = true
      interval(0, animationFrameScheduler)
        .pipe(
          takeUntil(fromEvent(this.el, 'ps-x-reach-end')),
          takeUntil(fromEvent(this, 'stopscroll')),
          takeUntil(fromEvent(this, 'stopscroll:left'))
        )
        .subscribe(() => { this.el.scrollLeft -= 6 })
    }
    if (ratio <= 0.9 && this.scrollingRight) {
      this.trigger('stopscroll:right')
      this.scrollingRight = false
    }
    if (ratio > 0.1 && this.scrollingLeft) {
      this.trigger('stopscroll:left')
      this.scrollingLeft = false
    }
  }
})

export default Marionette.View.extend({
  template: rootTemplate,
  className: 'root',
  regions: {
    columnsWrapper: { el: '[data-region=columns-wrapper]', replaceElement: true }
  },
  initialize () {
    this.scrollMachine = new ScrollMachine({ el: this.el })

    this.columnScroll$ = new Subject()
    this.columnScroll$
      .pipe(filter(e => e.event === 'column:dragover'))
      .pipe(map(e => e.data.dragEvent.x))
      .subscribe(x => this.scrollMachine.horizontalScrolling(x))
    this.columnScroll$
      .pipe(filter(e => e.event === 'column:dragover:stop'))
      .subscribe(() => this.scrollMachine.trigger('stopscroll'))
  },
  onRender () {
    this.showChildView('columnsWrapper', new ColumnsWrapper({
      collection: new Backbone.Collection(_.map(_.range(1000), n => { return { n } })),
      columnScroll$: this.columnScroll$
    }))
  },
  onAttach () {
    this.ps = new PerfectScrollbar(this.el)
    this.scrollMachine.setBoundings()
  }
})

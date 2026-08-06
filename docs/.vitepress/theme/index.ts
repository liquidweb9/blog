import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import DailyArticles from './components/DailyArticles.vue'
import CollapsibleHeadings from './components/CollapsibleHeadings.vue'
import './style.css'

export default {
  extends: DefaultTheme,
  Layout: () =>
    h(DefaultTheme.Layout, null, {
      'layout-bottom': () => h(CollapsibleHeadings)
    }),
  enhanceApp({ app }) {
    app.component('DailyArticles', DailyArticles)
  }
}

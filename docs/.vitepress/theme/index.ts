import DefaultTheme from 'vitepress/theme'
import DailyArticles from './components/DailyArticles.vue'
import './style.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('DailyArticles', DailyArticles)
  }
}

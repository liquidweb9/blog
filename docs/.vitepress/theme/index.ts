import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import './style.css'
import VisualEffects from './VisualEffects.vue'

export default {
  extends: DefaultTheme,
  Layout: () => h(DefaultTheme.Layout, null, {
    'layout-bottom': () => h(VisualEffects)
  })
}

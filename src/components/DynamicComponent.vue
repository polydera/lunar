<script setup lang="ts">
import { resolveComponent, inject, type Ref } from 'vue'
import { type UIAction, UIElement, type UIElementBase } from '@/types/ui'
import ActionButton from '@/components/ActionButton.vue'
import IconButton from '@/components/IconButton.vue'
import Separator from '@/components/Separator.vue'
import Column from '@/components/Column.vue'
import Row from '@/components/Row.vue'
import FormField from '@/components/FormField.vue'
import Property from '@/components/Property.vue'
import PreviewSelect from '@/components/PreviewSelect.vue'
import { useUIState } from '@/composables/useUIState'
import type { StateBag } from '@/composables/stateBag'
import { STATE_BAG_KEY } from '@/composables/stateBag'

const props = defineProps<{
  action: UIAction
}>()

const state = useUIState()
const runAction = inject<(id: string) => void>('runAction')
/**
 * Optional injected state bag. When present (e.g. a scene operator is active),
 * the v-model reads/writes via the bag instead of the global useUIState.
 */
const stateBag = inject<Ref<StateBag | null>>(STATE_BAG_KEY, null as unknown as Ref<StateBag | null>)

function getComponent(element: UIElement) {
  switch (element) {
    case UIElement.ACTION_BUTTON:
      return ActionButton
    case UIElement.ICON_BUTTON:
      return IconButton
    case UIElement.SEPARATOR:
      return Separator
    case UIElement.COLUMN:
      return Column
    case UIElement.ROW:
      return Row
    case UIElement.SLIDER:
      return resolveComponent('USlider')
    case UIElement.TOGGLE:
      return resolveComponent('USwitch')
    case UIElement.SELECT:
      return resolveComponent('USelect')
    case UIElement.PREVIEW_SELECT:
      return PreviewSelect
    case UIElement.PROPERTY:
      return Property
    default:
      throw new Error(`Unknown UIElement: ${element}`)
  }
}

const component = computed(() => getComponent(props.action.component))

const id = computed(() => {
  if ('id' in props.action.props) return (props.action.props as UIElementBase).id
  return undefined
})

const isButton = computed(
  () => props.action.component === UIElement.ACTION_BUTTON || props.action.component === UIElement.ICON_BUTTON,
)

const componentProps = computed(() => {
  if (props.action.component === UIElement.COLUMN || props.action.component === UIElement.ROW) {
    return {
      items: (props.action.props as { items: UIAction[] }).items,
    }
  } else if (props.action.isFormField) {
    const { label: _, id: __, description: ___, ...rest } = props.action.props as UIElementBase
    return rest
  }
  return props.action.props
})

const label = computed(() => {
  return 'label' in props.action.props ? (props.action.props as { label: string }).label : ''
})

const description = computed(() => {
  return 'description' in props.action.props ? (props.action.props as { description?: string }).description : undefined
})

const modelValue = computed({
  get: () => {
    if (!id.value) return undefined
    if (stateBag && stateBag.value) return stateBag.value.get(id.value)
    return state[id.value]
  },
  set: (value: unknown) => {
    if (!id.value) return
    if (stateBag && stateBag.value) {
      stateBag.value.set(id.value, value)
    } else {
      state[id.value] = value
    }
  },
})

function handleClick() {
  if (id.value && runAction) {
    runAction(id.value)
  }
}
</script>
<template>
  <FormField v-if="props.action.isFormField" :label="label" :description="description">
    <div v-if="props.action.component === UIElement.SLIDER" class="flex flex-row gap-2 items-center w-full">
      <component :is="component" v-bind="componentProps" v-model="modelValue" />
      <span class="text-xs text-default/70 w-10 text-right shrink-0">{{
        modelValue ?? (componentProps as any).min ?? 0
      }}</span>
    </div>
    <component v-else :is="component" v-bind="componentProps" v-model="modelValue" />
  </FormField>
  <component v-else-if="isButton" :is="component" v-bind="componentProps" @click="handleClick" />
  <component v-else :is="component" v-bind="componentProps" />
</template>

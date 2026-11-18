<script setup>
defineProps({ rows: { type: Array, required: true }, columns: { type: Array, required: true },
  rowKey: { type: String, required: true }, emptyText: { type: String, required: true }, removable: Boolean, disabled: Boolean });
defineEmits(['remove']);
</script>
<template>
  <div class="table-wrap"><table>
    <thead><tr><th v-for="column in columns" :key="column.key" scope="col">{{ column.label }}</th><th v-if="removable" scope="col">Action</th></tr></thead>
    <tbody>
      <tr v-for="row in rows" :key="row[rowKey]">
        <td v-for="column in columns" :key="column.key">{{ row[column.key] }}</td>
        <td v-if="removable"><button type="button" class="danger small" :disabled="disabled" :aria-label="`Delete ${row.name} (${row[rowKey]})`" @click="$emit('remove', row)">Delete</button></td>
      </tr>
      <tr v-if="rows.length === 0"><td class="empty" :colspan="columns.length + (removable ? 1 : 0)">{{ emptyText }}</td></tr>
    </tbody>
  </table></div>
</template>

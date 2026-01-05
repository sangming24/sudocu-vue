<script setup>
import SudokuBoard from '@/components/SudokuBoard.vue'
</script>

<template>
  <SudokuBoard />
</template>

<style>
/* 필요 시 글로벌 스타일 추가 */
html,
body {
  margin: 0;
  padding: 0;
  height: auto;
  overflow-y: auto; /* ✅ 스크롤은 body */
  -webkit-overflow-scrolling: touch;
  font-family: Arial, sans-serif;
  background-color: #fff;
}
</style>

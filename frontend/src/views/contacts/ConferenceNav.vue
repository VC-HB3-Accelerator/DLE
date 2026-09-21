<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->

<template>
  <nav class="conference-nav">
    <div v-if="showAgendaViewSelect" class="conference-nav-view">
      <label class="conference-nav-view-label" :for="viewSelectId">
        {{ t('contacts.conference.calendar.viewLabel') }}
      </label>
      <select
        :id="viewSelectId"
        v-model="viewMode"
        class="conference-nav-view-select"
        @change="onAgendaViewChange"
      >
        <option v-for="opt in agendaViewOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
    </div>

    <router-link
      v-for="item in visibleNavItems"
      :key="item.key"
      :to="item.to"
      class="conference-nav-link"
      active-class="is-active"
    >
      {{ t(item.labelKey) }}
    </router-link>
  </nav>
</template>

<script setup>
  import { computed } from 'vue';
  import { useI18n } from 'vue-i18n';
  import { useRoute } from 'vue-router';
  import { usePermissions } from '@/composables/usePermissions';
  import { useAuthContext } from '@/composables/useAuth';
  import { canAccessPath, ensureScreenAccessLoaded } from '@/composables/useScreenAccess.js';
  import { useConferenceAgendaView } from '@/composables/useConferenceAgendaView';

  const { t } = useI18n();
  const route = useRoute();
  const { isEditor } = usePermissions();
  const { userId } = useAuthContext();
  const { viewMode, showScheduleView } = useConferenceAgendaView();
  ensureScreenAccessLoaded();

  const viewSelectId = 'conference-nav-agenda-view';

  const contactId = computed(() => route.params.id);
  const isOwnCard = computed(
    () =>
      contactId.value != null &&
      userId.value != null &&
      String(contactId.value) === String(userId.value)
  );

  const showAgendaViewSelect = computed(() => route.name === 'contact-conference');

  const agendaViewOptions = computed(() => {
    const opts = [
      { value: 'timeGridDay', label: t('contacts.conference.calendar.views.day') },
      { value: 'timeGridWeek', label: t('contacts.conference.calendar.views.week') },
      { value: 'timeGridSevenDay', label: t('contacts.conference.calendar.views.sevenDay') },
      { value: 'dayGridMonth', label: t('contacts.conference.calendar.views.month') },
      { value: 'multiMonthYear', label: t('contacts.conference.calendar.views.year') },
    ];
    if (showScheduleView.value) {
      opts.push({
        value: 'listWeek',
        label: t('contacts.conference.calendar.views.schedule'),
      });
    }
    return opts;
  });

  function onAgendaViewChange() {
    const allowed = new Set(agendaViewOptions.value.map((o) => o.value));
    if (!allowed.has(viewMode.value)) {
      viewMode.value = 'dayGridMonth';
    }
  }

  const visibleNavItems = computed(() => {
    const items = [];
    // Часы приёма / слоты — только на своей карточке
    if (
      isOwnCard.value &&
      isEditor.value &&
      canAccessPath('/conferences/schedule')
    ) {
      items.push({
        key: 'availability',
        labelKey: 'contacts.conference.nav.availability',
        to: { name: 'hub-conference-schedule' },
      });
    }
    return items;
  });
</script>

<style scoped>
  .conference-nav {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }

  .conference-nav-link {
    display: inline-flex;
    align-items: center;
    padding: 8px 16px;
    border-radius: var(--block-radius);
    border: 1px solid var(--color-border);
    background: var(--color-white);
    color: var(--color-grey);
    text-decoration: none;
    font-size: var(--font-size-md);
    transition:
      background 0.2s,
      border-color 0.2s,
      color 0.2s;
  }

  .conference-nav-link:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .conference-nav-link.is-active {
    background: var(--color-primary);
    border-color: var(--color-primary);
    color: var(--color-white);
  }

  .conference-nav-view {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  .conference-nav-view-label {
    font-size: var(--font-size-sm);
    color: var(--color-grey);
    white-space: nowrap;
  }

  .conference-nav-view-select {
    min-width: 140px;
    padding: 7px 10px;
    border-radius: var(--block-radius);
    border: 1px solid var(--color-border);
    background: var(--color-white);
    color: inherit;
    font: inherit;
    font-size: var(--font-size-md);
  }

  @media (max-width: 768px) {
    .conference-nav,
    nav {
      max-width: 100%;
      flex-wrap: wrap;
      box-sizing: border-box;
    }
  }
</style>

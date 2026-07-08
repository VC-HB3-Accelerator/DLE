/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is prohibited.
 *
 * For licensing inquiries: info@hb3-accelerator.com
 * Website: https://hb3-accelerator.com
 * GitHub: https://github.com/VC-HB3-Accelerator
 */

import { ref, watch, inject, provide, computed } from 'vue';
import contactsService from '@/services/contactsService.js';

export const CONTACT_DETAILS_KEY = Symbol('contactDetails');

function createEmptyContact() {
  return {
    id: null,
    name: '',
    email: '',
    telegram: '',
    wallet: '',
    preferred_language: [],
    is_blocked: false,
    created_at: null,
  };
}

export function provideContactDetails(userId) {
  const contact = ref(null);
  const isLoading = ref(true);
  const isCreateMode = computed(() => userId.value === 'new');

  async function reloadContact() {
    if (!userId.value) {
      contact.value = null;
      isLoading.value = false;
      return;
    }

    if (isCreateMode.value) {
      contact.value = createEmptyContact();
      isLoading.value = false;
      return;
    }

    isLoading.value = true;
    try {
      contact.value = await contactsService.getContactById(userId.value);
    } catch {
      contact.value = null;
    } finally {
      isLoading.value = false;
    }
  }

  watch(userId, reloadContact, { immediate: true });

  const context = {
    userId,
    contact,
    isLoading,
    isCreateMode,
    reloadContact,
  };

  provide(CONTACT_DETAILS_KEY, context);
  return context;
}

export function useContactDetailsContext() {
  const context = inject(CONTACT_DETAILS_KEY);
  if (!context) {
    throw new Error('useContactDetailsContext must be used within ContactDetailsLayout');
  }
  return context;
}

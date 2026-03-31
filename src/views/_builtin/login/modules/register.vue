<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useRouterPush } from '@/hooks/common/router';
import { useNaiveForm } from '@/hooks/common/form';
import { fetchRegister } from '@/service/api';
import { $t } from '@/locales';

defineOptions({
  name: 'Register'
});

const { toggleLoginModule } = useRouterPush();
const { formRef, validate } = useNaiveForm();
const submitting = ref(false);

interface FormModel {
  userName: string;
  displayName: string;
  password: string;
  confirmPassword: string;
}

const model: FormModel = reactive({
  userName: '',
  displayName: '',
  password: '',
  confirmPassword: ''
});

const rules = computed<Record<keyof FormModel, App.Global.FormRule[]>>(() => {
  return {
    userName: [
      { required: true, message: '请输入用户名', trigger: 'blur' },
      { min: 2, max: 32, message: '用户名长度需在 2-32 位之间', trigger: 'blur' },
      { pattern: /^[a-zA-Z0-9_-]+$/, message: '只能包含字母、数字、下划线和短横线', trigger: 'blur' }
    ],
    displayName: [],
    password: [
      { required: true, message: '请输入密码', trigger: 'blur' },
      { min: 6, message: '密码长度不能少于 6 位', trigger: 'blur' }
    ],
    confirmPassword: [
      { required: true, message: '请确认密码', trigger: 'blur' },
      {
        validator: (_rule: unknown, value: string) => {
          if (value !== model.password) {
            return new Error('两次输入的密码不一致');
          }
          return true;
        },
        trigger: 'blur'
      }
    ]
  };
});

async function handleSubmit() {
  await validate();
  submitting.value = true;

  try {
    const { error } = await fetchRegister({
      userName: model.userName,
      password: model.password,
      confirmPassword: model.confirmPassword,
      displayName: model.displayName || undefined
    });

    if (!error) {
      window.$message?.success('注册申请已提交，请等待管理员审批');
      // 返回登录页
      toggleLoginModule('pwd-login');
    }
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <NForm ref="formRef" :model="model" :rules="rules" size="large" :show-label="false" @keyup.enter="handleSubmit">
    <NFormItem path="userName">
      <NInput v-model:value="model.userName" placeholder="用户名（字母、数字、下划线）" />
    </NFormItem>
    <NFormItem path="displayName">
      <NInput v-model:value="model.displayName" placeholder="昵称（可选）" />
    </NFormItem>
    <NFormItem path="password">
      <NInput
        v-model:value="model.password"
        type="password"
        show-password-on="click"
        :placeholder="$t('page.login.common.passwordPlaceholder')"
      />
    </NFormItem>
    <NFormItem path="confirmPassword">
      <NInput
        v-model:value="model.confirmPassword"
        type="password"
        show-password-on="click"
        :placeholder="$t('page.login.common.confirmPasswordPlaceholder')"
      />
    </NFormItem>
    <NSpace vertical :size="18" class="w-full">
      <NButton type="primary" size="large" round block :loading="submitting" @click="handleSubmit">
        提交注册申请
      </NButton>
      <NButton size="large" round block @click="toggleLoginModule('pwd-login')">
        {{ $t('page.login.common.back') }}
      </NButton>
    </NSpace>
  </NForm>
</template>

<style scoped></style>

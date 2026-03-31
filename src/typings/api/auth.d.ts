declare namespace Api {
  /**
   * namespace Auth
   *
   * backend api module: "auth"
   */
  namespace Auth {
    interface LoginToken {
      token: string;
      refreshToken: string;
    }

    interface UserInfo {
      userId: string;
      userName: string;
      roles: string[];
      buttons: string[];
    }

    interface RegisterParams {
      userName: string;
      password: string;
      confirmPassword: string;
      displayName?: string;
    }

    interface RegisterResult {
      userId: string;
      userName: string;
      status: 'pending' | 'active';
    }

    interface ChangePasswordParams {
      oldPassword: string;
      newPassword: string;
    }
  }
}

export interface LoginDTO {
  identifier: string; // email address OR username
  password:   string;
}

export interface RegisterDTO {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  username: string;
  phoneNumber?: string;
  otp: string;
}

export interface GoogleAuthDTO {
  googleId: string;
  email: string;
  firstName: string;
  lastName: string;
  profilePicture?: string;
}

export interface AuthResponseDTO {
  token: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    username?: string;
  };
}

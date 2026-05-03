import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type Language = "en" | "zh" | "es";

const translations = {
  en: {
    tutorial: "Tutorial",
    admin: "Admin",
    shop: "Shop",
    backpack: "Backpack",
    chats: "Chats",
    signIn: "Sign in",
    getStarted: "Get started",
    commandCenter: "command center",
    yourCommandCenter: "Your",
    commandCenterDesc: "Create chats, manage friends, and earn credits — all from here.",
    profileShop: "Profile shop",
    profileShopDesc: "Buy booster packs to roll 5 random avatars. Manage your collection in the backpack.",
    hiTechMessaging: "Hi-tech messaging",
    chatInRealTime: "Chat in",
    realTime: "real time",
    heroDesc: "Direct messages, group chats, friend requests, credits, and a profile-pack shop.",
    featureRealtime: "Real-time",
    featureRealtimeDesc: "Messages appear instantly for everyone in the chat.",
    featureSecure: "Secure",
    featureSecureDesc: "Authenticated accounts with role-based moderation.",
    featureFriends: "Friends + groups",
    featureFriendsDesc: "Add friends, DM them, or invite anyone via link.",
    send: "Send",
    typeMessage: "Type a message…",
    newChat: "New Chat",
    group: "Group",
    dm: "DM",
    groupName: "Group name",
    create: "Create",
    members: "Members",
    invite: "Invite",
    inviteLink: "Invite Link",
    rename: "Rename",
    leave: "Leave",
    delete: "Delete",
    close: "Close",
    settings: "Settings",
    adminOnly: "Admin-only chat",
    language: "Language",
    email: "Email",
    password: "Password",
    username: "Username",
    signUp: "Sign Up",
    login: "Login",
    noAccount: "Don't have an account?",
    haveAccount: "Already have an account?",
    credits: "Credits",
  },
  zh: {
    tutorial: "教程",
    admin: "管理",
    shop: "商店",
    backpack: "背包",
    chats: "聊天",
    signIn: "登录",
    getStarted: "开始使用",
    commandCenter: "指挥中心",
    yourCommandCenter: "你的",
    commandCenterDesc: "创建聊天、管理好友、赚取积分 — 一切从这里开始。",
    profileShop: "个人商店",
    profileShopDesc: "购买增强包来随机获取5个头像。在背包中管理你的收藏。",
    hiTechMessaging: "高科技通讯",
    chatInRealTime: "实时",
    realTime: "聊天",
    heroDesc: "私信、群聊、好友请求、积分和个人头像商店。",
    featureRealtime: "实时",
    featureRealtimeDesc: "消息即时显示给聊天中的每个人。",
    featureSecure: "安全",
    featureSecureDesc: "经过身份验证的帐户，基于角色的管理。",
    featureFriends: "好友 + 群组",
    featureFriendsDesc: "添加好友，发私信，或通过链接邀请任何人。",
    send: "发送",
    typeMessage: "输入消息…",
    newChat: "新聊天",
    group: "群组",
    dm: "私信",
    groupName: "群组名称",
    create: "创建",
    members: "成员",
    invite: "邀请",
    inviteLink: "邀请链接",
    rename: "重命名",
    leave: "离开",
    delete: "删除",
    close: "关闭",
    settings: "设置",
    adminOnly: "仅管理员可发言",
    language: "语言",
    email: "电子邮件",
    password: "密码",
    username: "用户名",
    signUp: "注册",
    login: "登录",
    noAccount: "没有帐户？",
    haveAccount: "已有帐户？",
    credits: "积分",
  },
  es: {
    tutorial: "Tutorial",
    admin: "Admin",
    shop: "Tienda",
    backpack: "Mochila",
    chats: "Chats",
    signIn: "Iniciar sesión",
    getStarted: "Comenzar",
    commandCenter: "centro de mando",
    yourCommandCenter: "Tu",
    commandCenterDesc: "Crea chats, gestiona amigos y gana créditos — todo desde aquí.",
    profileShop: "Tienda de perfil",
    profileShopDesc: "Compra paquetes para obtener 5 avatares aleatorios. Gestiona tu colección en la mochila.",
    hiTechMessaging: "Mensajería de alta tecnología",
    chatInRealTime: "Chatea en",
    realTime: "tiempo real",
    heroDesc: "Mensajes directos, chats grupales, solicitudes de amistad, créditos y tienda de avatares.",
    featureRealtime: "Tiempo real",
    featureRealtimeDesc: "Los mensajes aparecen instantáneamente para todos en el chat.",
    featureSecure: "Seguro",
    featureSecureDesc: "Cuentas autenticadas con moderación basada en roles.",
    featureFriends: "Amigos + grupos",
    featureFriendsDesc: "Agrega amigos, envía DMs o invita a cualquiera con un enlace.",
    send: "Enviar",
    typeMessage: "Escribe un mensaje…",
    newChat: "Nuevo Chat",
    group: "Grupo",
    dm: "DM",
    groupName: "Nombre del grupo",
    create: "Crear",
    members: "Miembros",
    invite: "Invitar",
    inviteLink: "Enlace de invitación",
    rename: "Renombrar",
    leave: "Salir",
    delete: "Eliminar",
    close: "Cerrar",
    settings: "Configuración",
    adminOnly: "Solo administradores pueden escribir",
    language: "Idioma",
    email: "Correo electrónico",
    password: "Contraseña",
    username: "Nombre de usuario",
    signUp: "Registrarse",
    login: "Iniciar sesión",
    noAccount: "¿No tienes cuenta?",
    haveAccount: "¿Ya tienes cuenta?",
    credits: "Créditos",
  },
} as const;

type Translations = { [K in keyof typeof translations.en]: string };

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextType>({
  language: "en",
  setLanguage: () => {},
  t: translations.en,
});

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem("app-language");
    return (saved as Language) || "en";
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("app-language", lang);
  };

  const t = translations[language];

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
'use strict';
const utility = require("utility");
const uuid = require('uuid');

module.exports = app => {
  if (app.config.debug) {
    app.config.coreMiddleware.unshift('less');
  }

  const localHandler = async (ctx, { username, password }) => {

    const getUser = username => {
      if (username.indexOf('@') > 0) {
        return ctx.service.user.getUserByMail(username);
      }
      return ctx.service.user.getUserByLoginName(username);
    };
    const existUser = await getUser(username);

    // 用户不存在
    if (!existUser) {
      console.log("ctx.body", ctx.body)
      // done("Incorrect login or password")
      return null;
    }

    const passhash = existUser.pass;
    // TODO: change to async compare
    const equal = ctx.helper.bcompare(password, passhash);
    // 密码不匹配
    if (!equal) {

      return null;
    }

    // 用户未激活
    if (!existUser.active) {
      let { loginname, email } = existUser

      // 发送激活邮件
      await ctx.service.mail.sendActiveMail(
        email,
        utility.md5(email + passhash + app.config.session_secret),
        loginname
      );
      return null;
    }

    // 验证通过
    return existUser;
  };

  const githubHandler = async (ctx, { profile }) => {
    const email = profile.emails && profile.emails[0] && profile.emails[0].value;
    let existUser = await ctx.service.user.getUserByGithubId(profile.id);

    // 用户不存在则创建
    if (!existUser) {
      existUser = new ctx.model.User();
      existUser.githubId = profile.id;
      existUser.active = true;
      existUser.accessToken = uuid.v4();
    }

    // 用户存在，更新字段
    existUser.loginname = profile.username;
    existUser.email = email || existUser.email;
    existUser.avatar = profile._json.avatar_url;
    existUser.githubUsername = profile.username;
    existUser.githubAccessToken = profile.accessToken;

    try {
      await existUser.save();
    } catch (ex) {
      if (ex.message.indexOf('duplicate key error') !== -1) {
        let err;
        if (ex.message.indexOf('email') !== -1) {
          err = new Error('您 GitHub 账号的 Email 与之前在 CNodejs 注册的 Email 重复了');
          err.code = 'duplicate_email';
          throw err;
        }

        if (ex.message.indexOf('loginname') !== -1) {
          err = new Error('您 GitHub 账号的用户名与之前在 CNodejs 注册的用户名重复了');
          err.code = 'duplicate_loginname';
          throw err;
        }
      }
      throw ex;
    }

    return existUser;
  };
  // weixin 鉴权处理
  const weixinHandler = async (ctx, profile) => {
    const email = profile.emails && profile.emails[0] && profile.emails[0].value;
    const unionid = profile.refreshToken.unionid;
    let existUser = await ctx.service.user.findByWeixinId(unionid);

    // 用户不存在则创建
    if (!existUser) {
      existUser = new ctx.model.User();
      existUser.weixinId = unionid;
      existUser.password = GeneratePassword(10, false)
    }
    // 用户存在，更新字段
    existUser.username = unionid;
    existUser.displayName = profile.displayName;
    existUser.email = email || existUser.email;
    existUser.profileImageUrl = profile.photo;

    try {
      await existUser.save();
      // await ctx.model.User.create(existUser);
    } catch (ex) {
      throw ex;
    }

    return existUser;
  };
  app.passport.verify(async (ctx, user, done) => {

    ctx.logger.debug('passport.verify', user);
    // const handler = user.provider === 'github' ? githubHandler : localHandler;
    let handler;
    switch (user.provider) {
      case 'local':
        handler = localHandler;
        break;
      case 'github':
        handler = githubHandler;
        break;
      case 'weixin':
        // passport-weixin 插件没有兼容egg-passport,没有ctx,创造一个匿名context实例
        ctx = app.createAnonymousContext();
        handler = weixinHandler;
        break;
      default:
        break;
    }
    const existUser = await handler(ctx, user);

    if (existUser) {
      // id存入Cookie, 用于验证过期.
      const auth_token = existUser._id + '$$$$'; // 以后可能会存储更多信息，用 $$$$ 来分隔
      const opts = {
        path: '/',
        maxAge: 1000 * 60 * 60 * 24 * 365,
        signed: true,
        httpOnly: true,
      };
      ctx.cookies.set(app.config.auth_cookie_name, auth_token, opts); // cookie 有效期30天
    }

    return existUser;
  });

  app.passport.deserializeUser(async (ctx, user) => {
    if (user) {
      const auth_token = ctx.cookies.get(ctx.app.config.auth_cookie_name, {
        signed: true,
      });

      if (!auth_token) {
        return user;
      }

      const auth = auth_token.split('$$$$');
      const user_id = auth[0];
      user = await ctx.service.user.getUserById(user_id);

      if (!user) {
        return user;
      }

      if (ctx.app.config.admins.hasOwnProperty(user.loginname)) {
        user.is_admin = true;
      }
    }

    return user;
  });
};


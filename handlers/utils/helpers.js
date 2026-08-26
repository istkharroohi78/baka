const helpers = {
  escapeHtml: (text) => {
    return text ? text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
  },
  
  getUserMention: (user) => {
    return user.username ? `@${user.username}` : user.first_name;
  }
};

module.exports = helpers;

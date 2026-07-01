// src/navigation/deepLinking.ts
export const linking = {
  prefixes: ['netflixpro://', 'https://netflixpro.app'],
  config: {
    screens: {
      MainTabs: {
        screens: {
          Home: 'home',
          Library: 'library',
          Settings: 'settings',
        },
      },
      DetailScreen: 'details/:mediaType/:mediaId',
      VideoPlayer: 'watch/:mediaType/:mediaId/:season?/:episode?',
    },
  },
};

export const parseDeepLink = (url: string) => {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;
    const params = Object.fromEntries(parsed.searchParams);

    if (path.startsWith('/details/')) {
      const [, mediaType, mediaId] = path.split('/');
      return { screen: 'DetailScreen', params: { mediaType, mediaId } };
    }

    if (path.startsWith('/watch/')) {
      const [, mediaType, mediaId, season, episode] = path.split('/');
      return { 
        screen: 'VideoPlayer', 
        params: { mediaType, mediaId, season: parseInt(season), episode: parseInt(episode) } 
      };
    }

    return null;
  } catch {
    return null;
  }
};

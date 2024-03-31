# jw3il.github.io

A static personal page created with [hugo](https://gohugo.io/).

The minimal template is based on [this blog post by Bryce Wray from 2022](https://www.brycewray.com/posts/2022/07/really-getting-started-hugo-four-steps/).

## Development

After [installing hugo](https://gohugo.io/installation/), you can start the development server with live reloading using

```
$ ./debug.sh
```

If you want to make the development version accessible to other devices in the network, you can add the argument `--bind=0.0.0.0`.

## Production

You can build the static production version of this website with

```
$ ./build.sh
```

The static website will be placed in the `/public` directory.

## License

The code in this repository is licensed under the MIT license.
The [/content](/content) is licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.en).

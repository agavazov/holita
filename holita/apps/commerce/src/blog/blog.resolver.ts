import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import type {
  MutationCreateBlogArticleArgs,
  MutationCreateBlogTagArgs,
  MutationUpdateBlogArticleArgs,
  MutationUpdateBlogTagArgs,
  QueryBlogArticleArgs,
  QueryBlogArticlesArgs,
  QueryBlogTagArgs,
  QueryBlogTagsArgs,
} from '../generated/graphql/types.js';
import type { RequestContext } from '../scope.js';
import { BlogService } from './blog.service.js';

@Resolver()
export class BlogResolver {
  constructor(private readonly blog: BlogService) {}

  @Query('blogArticles')
  articles(@Args() args: QueryBlogArticlesArgs, @Context() context: RequestContext) {
    return this.blog.listArticles(context, args);
  }

  @Query('blogArticle')
  article(@Args() args: QueryBlogArticleArgs, @Context() context: RequestContext) {
    return this.blog.article(context, args.id);
  }

  @Mutation('createBlogArticle')
  createArticle(@Args() args: MutationCreateBlogArticleArgs, @Context() context: RequestContext) {
    return this.blog.saveArticle(context, args.input);
  }

  @Mutation('updateBlogArticle')
  updateArticle(@Args() args: MutationUpdateBlogArticleArgs, @Context() context: RequestContext) {
    return this.blog.saveArticle(context, args.input, args.id);
  }

  @Query('blogTags')
  tags(@Args() args: QueryBlogTagsArgs, @Context() context: RequestContext) {
    return this.blog.listTags(context, args);
  }

  @Query('blogTag')
  tag(@Args() args: QueryBlogTagArgs, @Context() context: RequestContext) {
    return this.blog.tag(context, args.id);
  }

  @Query('blogTagChoices')
  tagChoices(@Context() context: RequestContext) {
    return this.blog.tagChoices(context);
  }

  @Mutation('createBlogTag')
  createTag(@Args() args: MutationCreateBlogTagArgs, @Context() context: RequestContext) {
    return this.blog.saveTag(context, args.input);
  }

  @Mutation('updateBlogTag')
  updateTag(@Args() args: MutationUpdateBlogTagArgs, @Context() context: RequestContext) {
    return this.blog.saveTag(context, args.input, args.id);
  }
}

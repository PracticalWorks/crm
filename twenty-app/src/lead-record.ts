// The lead record's option lists come from the client package's source, the one
// place they are defined, so the fields declared here and the values writers send
// cannot drift. Imported by path, not as a package: the app's package.json is
// uploaded to Twenty and installed there, where a workspace link would not resolve.
export * from '../../packages/client/src/lead-record.ts';

/**
 * Checks if a resouce is a valid matrix link.
 *
 * @param {string} resource - a matrix link. 
 * @returns {boolean}
*/
export const valid = (resource: string): boolean => {
  const matrixRegex = /^([#@+$!])[a-zA-Z0-9]+:([a-zA-Z0-9]+\.){1,}[a-zA-Z]{2,}$/;
  
  return matrixRegex.test(resource);
}
